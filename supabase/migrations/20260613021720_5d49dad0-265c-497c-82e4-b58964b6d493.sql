
-- 1) Hide game_rounds.secret from clients (column-level grant)
REVOKE SELECT ON public.game_rounds FROM authenticated, anon;
GRANT SELECT (id, status, started_at, deadline_at, ended_at, winner_id, winner_name, winner_value)
  ON public.game_rounds TO authenticated;
GRANT ALL ON public.game_rounds TO service_role;

-- 2) Realtime channel authorization — restrict who can subscribe to which topics
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- DMs: only sender or receiver, using topic "dm-msg:{minId}:{maxId}"
DROP POLICY IF EXISTS "dm realtime read" ON realtime.messages;
CREATE POLICY "dm realtime read"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'dm-msg:%' OR realtime.topic() LIKE 'dm-presence:%' OR realtime.topic() LIKE 'dm-unread:%'
      THEN position(auth.uid()::text in realtime.topic()) > 0
      WHEN realtime.topic() LIKE 'music:%' OR realtime.topic() LIKE 'room:%'
      THEN EXISTS (
        SELECT 1 FROM public.room_members rm
        WHERE rm.user_id = auth.uid()
          AND rm.room_id::text = split_part(realtime.topic(), ':', 2)
      )
      ELSE true
    END
  );

-- 3) Tighten room_logs INSERT to owners/admins only
DROP POLICY IF EXISTS "members write logs" ON public.room_logs;
CREATE POLICY "owners and admins write logs"
  ON public.room_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.room_rank_of(room_id, auth.uid()) IN ('owner', 'admin')
  );

-- 4) user_inventory: restrict to authenticated users only
DROP POLICY IF EXISTS "inv_read_all" ON public.user_inventory;
CREATE POLICY "inv_read_authenticated"
  ON public.user_inventory FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.user_inventory FROM anon;
