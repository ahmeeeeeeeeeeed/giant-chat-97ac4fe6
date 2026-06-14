
-- 1) Remove direct INSERT into room_members; force joins through room_join() / add_member_to_room()
DROP POLICY IF EXISTS "users can join rooms themselves" ON public.room_members;

-- 2) Prevent self-promotion: only owners/admins can update memberships
DROP POLICY IF EXISTS "owners/admins can update memberships" ON public.room_members;
CREATE POLICY "owners/admins can update memberships"
  ON public.room_members
  FOR UPDATE
  TO authenticated
  USING (public.room_rank_of(room_id, auth.uid()) = ANY (ARRAY['owner'::public.room_rank, 'admin'::public.room_rank]))
  WITH CHECK (public.room_rank_of(room_id, auth.uid()) = ANY (ARRAY['owner'::public.room_rank, 'admin'::public.room_rank]));

-- 3) Block client-side writes to daily progress; SECURITY DEFINER RPCs handle writes
DROP POLICY IF EXISTS "udp_self_write" ON public.user_daily_progress;
-- read policy udp_self_read remains so users can see their own progress
