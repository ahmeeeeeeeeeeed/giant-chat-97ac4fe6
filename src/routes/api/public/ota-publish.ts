import { createFileRoute } from '@tanstack/react-router'
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * POST /api/public/ota-publish
 *
 * يُستدعى من GitHub Actions بعد رفع bundle.zip إلى GitHub Releases.
 *
 * Headers المطلوبة:
 *   - x-ota-signature: HMAC-SHA256 hex للـ raw body باستخدام OTA_PUBLISH_SECRET
 *   - x-ota-timestamp: Unix timestamp (ثوانٍ) — يجب ألا يتجاوز 5 دقائق
 *   - content-type: application/json
 *
 * Body:
 *   { "version": "1.0.123", "url": "https://github.com/.../bundle.zip", "message": "optional" }
 *   أو للـ rollback:
 *   { "action": "rollback" }
 *
 * الأمان:
 *   - HMAC على (timestamp + "." + body) لمنع replay
 *   - timingSafeEqual لمنع timing attacks
 *   - يستخدم supabaseAdmin لاستدعاء RPC: ota_publish_bundle / ota_rollback
 */
export const Route = createFileRoute('/api/public/ota-publish')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.OTA_PUBLISH_SECRET
        if (!secret) {
          return new Response('Server not configured', { status: 503 })
        }

        const signature = request.headers.get('x-ota-signature') ?? ''
        const timestamp = request.headers.get('x-ota-timestamp') ?? ''
        const rawBody = await request.text()

        // 1) تحقق من timestamp (يمنع replay attacks)
        const ts = Number(timestamp)
        if (!Number.isFinite(ts)) {
          return new Response('Invalid timestamp', { status: 401 })
        }
        const nowSec = Math.floor(Date.now() / 1000)
        if (Math.abs(nowSec - ts) > 300) {
          return new Response('Stale request', { status: 401 })
        }

        // 2) تحقق من HMAC
        const expected = createHmac('sha256', secret)
          .update(`${timestamp}.${rawBody}`)
          .digest('hex')

        const sigBuf = Buffer.from(signature, 'hex')
        const expBuf = Buffer.from(expected, 'hex')
        if (
          sigBuf.length !== expBuf.length ||
          !timingSafeEqual(sigBuf, expBuf)
        ) {
          return new Response('Invalid signature', { status: 401 })
        }

        // 3) parse + validate
        let payload: {
          action?: 'rollback'
          version?: string
          url?: string
          message?: string
        }
        try {
          payload = JSON.parse(rawBody)
        } catch {
          return new Response('Invalid JSON', { status: 400 })
        }

        const { supabaseAdmin } = await import(
          '@/integrations/supabase/client.server'
        )

        // Rollback path
        if (payload.action === 'rollback') {
          const { data, error } = await supabaseAdmin.rpc('ota_rollback')
          if (error) {
            return new Response(
              JSON.stringify({ ok: false, error: error.message }),
              { status: 500, headers: { 'content-type': 'application/json' } },
            )
          }
          return Response.json({ ok: true, action: 'rollback', result: data })
        }

        // Publish path
        if (!payload.version || !payload.url) {
          return new Response('Missing version or url', { status: 400 })
        }
        if (!/^https:\/\//.test(payload.url)) {
          return new Response('URL must be https', { status: 400 })
        }
        if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(payload.version)) {
          return new Response('version must be semver X.Y.Z', { status: 400 })
        }

        const { data, error } = await supabaseAdmin.rpc('ota_publish_bundle', {
          _version: payload.version,
          _url: payload.url,
          _message: payload.message ?? undefined,
        })

        if (error) {
          return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            { status: 500, headers: { 'content-type': 'application/json' } },
          )
        }

        return Response.json({
          ok: true,
          action: 'publish',
          version: payload.version,
          url: payload.url,
          result: data,
        })
      },
    },
  },
})
