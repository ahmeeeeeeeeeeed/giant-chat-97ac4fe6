import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Issue a verification code for the current user's chosen recovery email.
// Returns the code so the client can show it (dev fallback until email infra
// is configured). When email infra is configured, the code should be sent
// via email instead of being returned.
export const requestEmailVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => {
    if (!d?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
      throw new Error("invalid_email");
    }
    return { email: d.email.trim().toLowerCase() };
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc(
      "issue_email_verification_code",
      { _email: data.email },
    );
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { code: row?.code as string, expiresAt: row?.expires_at as string };
  });

export const confirmEmailVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => ({ code: String(d?.code || "").trim() }))
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc(
      "confirm_email_verification_code",
      { _code: data.code },
    );
    if (error) throw new Error(error.message);
    return { ok: !!ok };
  });

// Account recovery: anonymous user requests a code by username + email.
// Uses service role to look up the verified recovery email.
export const requestAccountRecovery = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; email: string }) => ({
    username: String(d?.username || "").trim(),
    email: String(d?.email || "").trim().toLowerCase(),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("issue_recovery_code", {
      _username: data.username,
      _email: data.email,
    });
    if (error) {
      // Don't leak existence; return generic ok
      return { ok: false, code: null as string | null };
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    // TODO: send `row.code` to `row.email` via email provider once configured.
    return { ok: true, code: (row?.code as string) ?? null };
  });

export const resetPasswordWithCode = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; code: string; newPassword: string }) => {
    if (!d?.newPassword || d.newPassword.length < 6) throw new Error("weak_password");
    return {
      username: String(d.username || "").trim(),
      code: String(d.code || "").trim(),
      newPassword: d.newPassword,
    };
  })
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
