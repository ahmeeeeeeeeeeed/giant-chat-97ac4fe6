import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Issue a verification code for the current user's chosen recovery email.
// SECURITY: never return the OTP code to the client. The code must be
// delivered out-of-band (email). Until email infra is wired up, we only
// return { ok: true } and log server-side. This prevents XSS/session
// hijack from completing email verification silently.
export const requestEmailVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ email: z.string().email().max(254) })
      .transform((v) => ({ email: v.email.trim().toLowerCase() }))
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc(
      "issue_email_verification_code",
      { _email: data.email },
    );
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    // TODO: send `row.code` to `data.email` via email provider once configured.
    // NEVER include the code in the response.
    if (row?.code) {
      console.log(`[verification] code issued for ${data.email}`);
    }
    return { ok: true, expiresAt: (row?.expires_at as string) ?? null };
  });

export const confirmEmailVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().min(4).max(64) })
      .transform((v) => ({ code: v.code.trim() }))
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc(
      "confirm_email_verification_code",
      { _code: data.code },
    );
    if (error) throw new Error(error.message);
    return { ok: !!ok };
  });

// Account recovery: anonymous user requests a code by username + email.
// SECURITY: the OTP code MUST NEVER be returned to the unauthenticated
// caller. Otherwise any attacker who knows a username + recovery email
// can take over the account without ever touching the email inbox.
// Until an email provider is wired in, this endpoint returns the same
// generic { ok: true } regardless of whether the lookup matched, to
// avoid enumeration.
export const requestAccountRecovery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.string().min(1).max(80),
        email: z.string().email().max(254),
      })
      .transform((v) => ({
        username: v.username.trim(),
        email: v.email.trim().toLowerCase(),
      }))
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabaseAdmin.rpc("issue_recovery_code", {
        _username: data.username,
        _email: data.email,
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (row?.code) {
        // TODO: deliver `row.code` to `data.email` via your email provider.
        console.log(`[recovery] code issued for ${data.username}`);
      }
    } catch {
      // swallow to avoid leaking existence
    }
    // Always return a uniform response — never the code.
    return { ok: true };
  });

export const resetPasswordWithCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.string().min(1).max(80),
        code: z.string().min(4).max(64),
        newPassword: z.string().min(6).max(128),
      })
      .transform((v) => ({
        username: v.username.trim(),
        code: v.code.trim(),
        newPassword: v.newPassword,
      }))
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: uid, error } = await supabaseAdmin.rpc("consume_recovery_code", {
      _username: data.username,
      _code: data.code,
    });
    if (error || !uid) throw new Error("invalid_code");
    const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(uid as string, {
      password: data.newPassword,
    });
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });
