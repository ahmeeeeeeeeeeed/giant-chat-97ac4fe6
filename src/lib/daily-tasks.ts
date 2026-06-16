import { supabase } from "@/integrations/supabase/client";

// Best-effort daily-task progress logging. Failures are swallowed so a
// gamification miss never blocks the user-facing action.
export async function recordDailyAction(
  kind: "daily_login" | "send_messages" | "join_rooms" | "react_messages" | "publish_post" | "publish_story",
  amount = 1,
) {
  try {
    await supabase.rpc("record_daily_action", { _kind: kind, _amount: amount });
  } catch {
    /* ignore */
  }
}
