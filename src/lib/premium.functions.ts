import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PREMIUM_COST = 50_000;

// Strict runtime schema for premium creation. TypeScript types are erased
// at runtime, so we MUST validate explicitly to keep malformed payloads
// (object/array username, oversized password, control chars) from reaching
// the admin auth API.
const premiumInputSchema = z.object({
  username: z
    .string()
    // Trim outer whitespace, then collapse internal runs of spaces.
    .transform((s) => (s ?? "").trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2, "اسم المستخدم يجب أن يكون بين 2 و 30 حرفاً")
        .max(30, "اسم المستخدم يجب أن يكون بين 2 و 30 حرفاً")
        // Allow Arabic letters, Latin letters, digits, single spaces, and
        // decorative symbols (★ ♛ ✦ ❀ ✧ etc.). Only reject '@' and ASCII
        // control characters which break the synthetic email mapping.
        .regex(/^[^@\u0000-\u001F\u007F]+$/, "اسم المستخدم يحتوي على رموز غير مسموحة"),
    ),
  password: z
    .string()
    .min(6, "كلمة المرور 6 أحرف على الأقل")
    .max(128, "كلمة المرور طويلة جداً"),
});

function validateUsername(u: string): string {
  // Defence-in-depth — also called from inside createPremiumUser.
  return premiumInputSchema.shape.username.parse(u ?? "");
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

  const { error: mErr } = await supabaseAdmin.rpc("mark_profile_premium", {
    _target: created.user.id,
    _username: username,
    _email: email,
  } as never);
  if (mErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    throw new Error(mErr.message);
  }
  return { ok: true, userId: created.user.id, username };
}

export const createPremiumByPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => premiumInputSchema.parse(input))
  .handler(async ({ data, context }) => {
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
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: prof } = await supabaseAdmin.from("profiles").select("points").eq("id", context.userId).maybeSingle();
        if (prof) await supabaseAdmin.from("profiles").update({ points: (prof.points ?? 0) + PREMIUM_COST }).eq("id", context.userId);
      } catch { /* ignore */ }
      throw e;
    }
  });

export const adminCreatePremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => premiumInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    return createPremiumUser(data);
  });
