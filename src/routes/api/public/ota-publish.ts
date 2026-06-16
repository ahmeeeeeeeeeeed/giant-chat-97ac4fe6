import { createFileRoute } from '@tanstack/react-router'
import { createHash, createHmac, timingSafeEqual } from 'crypto'

/**
 * POST /api/public/ota-publish
 *
 * يُستدعى من GitHub Actions بعد بناء bundle.zip.
 *
 * Headers المطلوبة:
 *   - x-ota-signature: HMAC-SHA256 hex للـ raw body باستخدام OTA_PUBLISH_SECRET
 *   - x-ota-timestamp: Unix timestamp (ثوانٍ) — يجب ألا يتجاوز 5 دقائق
 *   - content-type: application/json
 *
 * Body:
 *   binary zip مع headers: x-ota-version / x-ota-sha256 / x-ota-message-b64
 *   أو legacy JSON: { "version": "1.0.123", "url": "https://.../bundle.zip", "message": "optional" }
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
        const rawBuffer = await request.arrayBuffer()
        const contentType = request.headers.get('content-type') ?? ''
        const isApkUpload = contentType.includes('application/vnd.android.package-archive') || request.headers.has('x-ota-apk-version')
        const isBinaryBundle = !isApkUpload && (contentType.includes('application/zip') || request.headers.has('x-ota-version'))

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
        const rawBody = (isBinaryBundle || isApkUpload) ? '' : new TextDecoder().decode(rawBuffer)
        const bundleVersion = request.headers.get('x-ota-version') ?? ''
        const apkVersion = request.headers.get('x-ota-apk-version') ?? ''
        const declaredHash = request.headers.get('x-ota-sha256') ?? ''
        const signedPayload = isBinaryBundle
          ? `${timestamp}.${bundleVersion}.${declaredHash}`
          : isApkUpload
            ? `${timestamp}.apk.${apkVersion}.${declaredHash}`
          : `${timestamp}.${rawBody}`
        const expected = createHmac('sha256', secret).update(signedPayload).digest('hex')

        const sigBuf = Buffer.from(signature, 'hex')
        const expBuf = Buffer.from(expected, 'hex')
        if (
          sigBuf.length !== expBuf.length ||
          !timingSafeEqual(sigBuf, expBuf)
        ) {
          return new Response('Invalid signature', { status: 401 })
        }

        const { supabaseAdmin } = await import(
          '@/integrations/supabase/client.server'
        )

        if (isApkUpload) {
          if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(apkVersion)) {
            return new Response('apk version must be semver X.Y.Z', { status: 400 })
          }
          if (!/^[a-f0-9]{64}$/i.test(declaredHash)) {
            return new Response('Invalid apk hash', { status: 400 })
          }

          const apk = Buffer.from(rawBuffer)
          const actualHash = createHash('sha256').update(apk).digest('hex')
          if (actualHash.toLowerCase() !== declaredHash.toLowerCase()) {
            return new Response('APK hash mismatch', { status: 400 })
          }

          const path = `apk/giant-${apkVersion}-${Date.now()}.apk`
          const { error: uploadError } = await supabaseAdmin.storage
            .from('app-updates')
            .upload(path, apk, {
              contentType: 'application/vnd.android.package-archive',
              cacheControl: '31536000',
              upsert: true,
            })
          if (uploadError) {
            return Response.json({ ok: false, error: uploadError.message }, { status: 500 })
          }

          const tenYears = 60 * 60 * 24 * 365 * 10
          const { data: signed, error: signedError } = await supabaseAdmin.storage
            .from('app-updates')
            .createSignedUrl(path, tenYears)
          if (signedError || !signed?.signedUrl) {
            return Response.json({ ok: false, error: signedError?.message ?? 'Failed to create APK URL' }, { status: 500 })
          }

          const toCode = (v: string) => {
            const [maj = 0, min = 0, pat = 0] = v.split('.').map((n) => Number.parseInt(n, 10) || 0)
            return maj * 10000 + min * 100 + pat
          }
          const messageB64 = request.headers.get('x-ota-message-b64') ?? ''
          const message = messageB64 ? Buffer.from(messageB64, 'base64').toString('utf8') : 'تحديث جديد متاح لتحسين الأداء والاستقرار.'
          const versionCode = toCode(apkVersion)
          const { data: existing } = await supabaseAdmin
            .from('app_updates')
            .select('id')
            .eq('version', apkVersion)
            .maybeSingle()

          if (existing?.id) {
            await supabaseAdmin.from('app_updates').update({ is_active: false }).neq('id', existing.id)
            const { error } = await supabaseAdmin
              .from('app_updates')
              .update({
                version_code: versionCode,
                minimum_required_version: '1.0.0',
                minimum_required_code: 10000,
                update_message: message,
                update_type: 'optional',
                file_url: signed.signedUrl,
                file_size: apk.length,
                is_active: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
            if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
          } else {
            await supabaseAdmin.from('app_updates').update({ is_active: false }).eq('is_active', true)
            const { error } = await supabaseAdmin.from('app_updates').insert({
              version: apkVersion,
              version_code: versionCode,
              minimum_required_version: '1.0.0',
              minimum_required_code: 10000,
              update_message: message,
              update_type: 'optional',
              file_url: signed.signedUrl,
              file_size: apk.length,
              is_active: true,
            })
            if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
          }

          return Response.json({ ok: true, action: 'apk', version: apkVersion, url: signed.signedUrl })
        }

        if (isBinaryBundle) {
          if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(bundleVersion)) {
            return new Response('version must be semver X.Y.Z', { status: 400 })
          }
          if (!/^[a-f0-9]{64}$/i.test(declaredHash)) {
            return new Response('Invalid bundle hash', { status: 400 })
          }

          const bundle = Buffer.from(rawBuffer)
          const actualHash = createHash('sha256').update(bundle).digest('hex')
          if (actualHash.toLowerCase() !== declaredHash.toLowerCase()) {
            return new Response('Bundle hash mismatch', { status: 400 })
          }

          const messageB64 = request.headers.get('x-ota-message-b64') ?? ''
          const message = messageB64 ? Buffer.from(messageB64, 'base64').toString('utf8') : undefined
          const path = `ota/bundle-${bundleVersion}-${Date.now()}.zip`
          const { error: uploadError } = await supabaseAdmin.storage
            .from('app-updates')
            .upload(path, bundle, {
              contentType: 'application/zip',
              cacheControl: '31536000',
              upsert: true,
            })
          if (uploadError) {
            return Response.json({ ok: false, error: uploadError.message }, { status: 500 })
          }

          const tenYears = 60 * 60 * 24 * 365 * 10
          const { data: signed, error: signedError } = await supabaseAdmin.storage
            .from('app-updates')
            .createSignedUrl(path, tenYears)
          if (signedError || !signed?.signedUrl) {
            return Response.json({ ok: false, error: signedError?.message ?? 'Failed to create download URL' }, { status: 500 })
          }

          const { data, error } = await supabaseAdmin.rpc('ota_publish_bundle', {
            _version: bundleVersion,
            _url: signed.signedUrl,
            _message: message,
          })
          if (error) {
            return Response.json({ ok: false, error: error.message }, { status: 500 })
          }

          return Response.json({ ok: true, action: 'publish', version: bundleVersion, url: signed.signedUrl, result: data })
        }

        // 3) parse + validate legacy JSON requests
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
