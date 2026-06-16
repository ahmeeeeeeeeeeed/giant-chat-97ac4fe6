
-- 1) rooms.password_hash: revoke broad SELECT and re-grant only non-sensitive columns
REVOKE SELECT ON public.rooms FROM authenticated;
REVOKE SELECT ON public.rooms FROM anon;
GRANT SELECT (id, name, description, owner_id, created_at, type, max_members, is_active, background_url, background_type)
  ON public.rooms TO authenticated;
GRANT SELECT (id, name, description, owner_id, created_at, type, max_members, is_active, background_url, background_type)
  ON public.rooms TO anon;

-- 2) room_message_reactions: members-only read
DROP POLICY IF EXISTS "reactions readable by authenticated" ON public.room_message_reactions;
CREATE POLICY "reactions readable by room members"
  ON public.room_message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_messages m
      WHERE m.id = room_message_reactions.message_id
        AND public.is_room_member(m.room_id, auth.uid())
    )
  );

-- 3) realtime: restrict room-* topics to room members
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname='realtime' AND tablename='messages'
       AND policyname ILIKE '%channel auth%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime.messages', pol.policyname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.realtime_topic_allowed()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  t text := realtime.topic();
  uid uuid := auth.uid();
  seg text;
  rid uuid;
BEGIN
  IF uid IS NULL OR t IS NULL THEN RETURN false; END IF;
  seg := split_part(t, ':', 2);

  -- DM / user-scoped topics: must match own uid
  IF t LIKE 'dm-msg:%' OR t LIKE 'dm-presence:%' OR t LIKE 'dm-unread:%'
     OR t LIKE 'user:%' OR t LIKE 'profile:%'
     OR t LIKE 'friends:%' OR t LIKE 'notifications:%' THEN
    RETURN seg = uid::text;
  END IF;

  -- Room-scoped topics: must be a room member
  IF t LIKE 'room:%' OR t LIKE 'room-%' THEN
    BEGIN
      rid := seg::uuid;
    EXCEPTION WHEN others THEN
      RETURN false;
    END;
    RETURN public.is_room_member(rid, uid);
  END IF;

  -- Other topics (e.g. game:*, public broadcasts) allowed to any authenticated user
  RETURN true;
END $$;

CREATE POLICY "channel auth select"
  ON realtime.messages FOR SELECT TO authenticated
  USING (public.realtime_topic_allowed());

CREATE POLICY "channel auth insert"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (public.realtime_topic_allowed());
