import { supabase } from "@/integrations/supabase/client";

let cached: string | null | undefined;

/** Returns the user_id of the first user with role 'admin'. Cached for the session. */
export async function findAdminId(): Promise<string | null> {
  if (cached !== undefined) return cached;
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  cached = data?.user_id ?? null;
  return cached;
}
