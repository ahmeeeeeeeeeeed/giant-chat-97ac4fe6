
-- 1) user_inventory: restrict SELECT to owner only
DROP POLICY IF EXISTS inv_read_authenticated ON public.user_inventory;
CREATE POLICY inv_read_own ON public.user_inventory
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2) game_rounds: exclude `secret` from Realtime publication so subscribers
-- never receive it. SECURITY DEFINER functions still read it server-side.
ALTER PUBLICATION supabase_realtime DROP TABLE public.game_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rounds
  (id, status, started_at, deadline_at, ended_at, winner_id, winner_name, winner_value);

-- 3) profiles.recovery_email/recovery_email_verified_at:
-- column-level SELECT was already revoked from anon/authenticated; ensure it
-- stays that way and that no broad policy can leak the column. Re-assert.
REVOKE SELECT (recovery_email, recovery_email_verified_at)
  ON public.profiles FROM anon, authenticated;
