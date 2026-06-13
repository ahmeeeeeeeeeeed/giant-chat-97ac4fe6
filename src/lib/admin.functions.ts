import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; newPassword: string }) => {
    if (!input.userId) throw new Error("userId required");
    if (!input.newPassword || input.newPassword.length < 6) throw new Error("Password must be at least 6 characters");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetPasswordHash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("_admin_password_view" as never)
      .select("hash")
      .eq("user_id", data.userId)
      .maybeSingle();
    // Fallback: query auth.users directly via RPC since direct table access not allowed
    if (error || !row) {
      const { data: rpcRow, error: rpcErr } = await supabaseAdmin.rpc("admin_get_password_hash" as never, { _target: data.userId } as never);
      if (rpcErr) throw new Error(rpcErr.message);
      return { hash: String(rpcRow ?? ""), reversible: false };
    }
    return { hash: String((row as { hash: string }).hash ?? ""), reversible: false };
  });
