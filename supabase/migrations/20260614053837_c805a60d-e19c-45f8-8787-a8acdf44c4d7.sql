
-- 1) Forbid client-side inserts into room_logs (SECURITY DEFINER triggers still work)
DROP POLICY IF EXISTS "owners and admins write logs" ON public.room_logs;

-- 2) Make intent explicit: deny all direct client inserts on room_members
DROP POLICY IF EXISTS "deny_direct_client_inserts" ON public.room_members;
CREATE POLICY "deny_direct_client_inserts"
  ON public.room_members AS RESTRICTIVE
  FOR INSERT TO authenticated, anon
  WITH CHECK (false);
