
-- Fix 1: Hide rooms.password_hash from authenticated SELECT (column-level revoke).
-- The room_join SECURITY DEFINER function still reads it server-side.
REVOKE SELECT (password_hash) ON public.rooms FROM authenticated;
REVOKE SELECT (password_hash) ON public.rooms FROM anon;

-- Fix 2: Extend realtime channel-authorization policy to explicitly cover
-- additional topic prefixes used by user-scoped, community, and game features.
-- Topics outside the allow-list still return false (default deny).
DROP POLICY IF EXISTS "dm realtime read" ON realtime.messages;

CREATE POLICY "channel auth" ON realtime.messages
FOR SELECT TO authenticated
USING (
  CASE
    -- DM topics carry the user's uid in the topic name
    WHEN realtime.topic() LIKE 'dm-msg:%'
      OR realtime.topic() LIKE 'dm-presence:%'
      OR realtime.topic() LIKE 'dm-unread:%'
      THEN POSITION(auth.uid()::text IN realtime.topic()) > 0

    -- Room / music topics: only members of the referenced room
    WHEN realtime.topic() LIKE 'music:%'
      OR realtime.topic() LIKE 'room:%'
      THEN EXISTS (
        SELECT 1 FROM public.room_members rm
        WHERE rm.user_id = auth.uid()
          AND rm.room_id::text = split_part(realtime.topic(), ':', 2)
      )

    -- Per-user private topics: topic must include the subscriber's uid
    WHEN realtime.topic() LIKE 'user:%'
      OR realtime.topic() LIKE 'profile:%'
      OR realtime.topic() LIKE 'friends:%'
      OR realtime.topic() LIKE 'notifications:%'
      THEN POSITION(auth.uid()::text IN realtime.topic()) > 0

    -- Public broadcast topics readable by any authenticated user.
    -- Underlying tables still enforce RLS on row visibility.
    WHEN realtime.topic() LIKE 'community:%'
      OR realtime.topic() LIKE 'announcements:%'
      OR realtime.topic() LIKE 'game:%'
      OR realtime.topic() LIKE 'leaderboard:%'
      THEN true

    ELSE false
  END
);
