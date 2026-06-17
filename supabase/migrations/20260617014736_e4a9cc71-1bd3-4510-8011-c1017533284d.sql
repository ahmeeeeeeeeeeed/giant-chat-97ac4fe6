
-- 1) Restrict app_config reads to authenticated users only.
DROP POLICY IF EXISTS "cfg_read_all" ON public.app_config;
CREATE POLICY "cfg_read_authenticated"
  ON public.app_config FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.app_config FROM anon;

-- 2) Tighten reaction inserts to room members only.
DROP POLICY IF EXISTS "users add own reactions" ON public.room_message_reactions;
CREATE POLICY "users add own reactions"
  ON public.room_message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.room_messages m
      WHERE m.id = room_message_reactions.message_id
        AND public.is_room_member(m.room_id, auth.uid())
    )
  );
