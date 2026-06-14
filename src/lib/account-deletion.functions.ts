import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const approveAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: rErr } = await supabaseAdmin
      .from("account_deletion_requests")
      .select("id, user_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("Already reviewed");

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(req.user_id);
    if (delErr) throw new Error(delErr.message);

    await supabaseAdmin
      .from("account_deletion_requests")
      .update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.requestId);

    return { ok: true };
  });

export const rejectAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("account_deletion_requests")
      .update({ status: "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.requestId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
