import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PREMIUM_COST = 50_000;

// Username: 2..30 chars, anything visible (Arabic / decorated / latin), no whitespace at ends.
// Disallow control chars and '@' to avoid conflicts with emails.
function validateUsername(u: string): string {
  const v = (u ?? "").trim();
  if (v.length < 2 || v.length > 30) throw new Error("اسم المستخدم يجب أن يكون بين 2 و 30 حرفاً");
  if (/[\s@\u0000-\u001F\u007F]/.test(v)) throw new Error("اسم المستخدم يحتوي على رموز غير مسموحة");
  return v;
}

function syntheticEmail(): string {
  const id = crypto.randomUUID().replace(/-/g, "");
  return `premium_${id}@giant.app`;
}

async function ensureUsernameAvailable(supabaseAdmin: any, username: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (data) throw new Error("اسم المستخدم محجوز بالفعل");
}

async function createPremiumUser(opts: { username: string; password: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const username = validateUsername(opts.username);
  if (!opts.password || opts.password.length < 6) throw new Error("كلمة المرور 6 أحرف على الأقل");
  await ensureUsernameAvailable(supabaseAdmin, username);

  const email = syntheticEmail();
  const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: opts.password,
    email_confirm: true,
    user_metadata: { username, is_premium: true },
  });
  if (cErr || !created.user) throw new Error(cErr?.message ?? "تعذّر إنشاء الحساب");

  // The handle_new_user trigger inserted a profile from metadata.
  // Stamp it as premium and persist the auth email for username->email lookup.
  const { error: mErr } = await supabaseAdmin.rpc("mark_profile_premium", {
    _target: created.user.id,
    _username: username,
    _email: email,
  } as never);
  if (mErr) {
    // best-effort cleanup
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    throw new Error(mErr.message);
  }
  return { ok: true, userId: created.user.id, username };
}

export const createPremiumByPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    // Atomically charge points from the signed-in user (RLS as that user).
    const { error: payErr } = await context.supabase.rpc("premium_charge_points", { _cost: PREMIUM_COST } as never);
    if (payErr) {
      if (String(payErr.message).includes("insufficient_points")) {
        throw new Error("لا يوجد نقاط كافية لإنشاء حساب مميز");
      }
      throw new Error(payErr.message);
    }
    try {
      return await createPremiumUser(data);
    } catch (e) {
      // refund on failure
      await context.supabase.rpc("admin_send_points", { _target: context.userId, _amount: PREMIUM_COST } as never).catch(() => {});
      throw e;
    }
  });

export const adminCreatePremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    return createPremiumUser(data);
  });
