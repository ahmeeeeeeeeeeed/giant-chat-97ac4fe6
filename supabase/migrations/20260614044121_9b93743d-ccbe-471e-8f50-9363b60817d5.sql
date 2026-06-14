-- 1) bot_subagents: hide bcrypt password column
REVOKE SELECT ON public.bot_subagents FROM authenticated, anon;
GRANT SELECT (id, owner_id, name, room_id, silent, created_at) ON public.bot_subagents TO authenticated;

-- 2) profiles: hide auth_email and recovery_email (mirror of recovery_email handling)
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (
  id, username, avatar_url, bio, last_seen_at, created_at, points, gender, country,
  hide_last_seen, dm_locked, profile_views, equipped_badge, equipped_name_color,
  equipped_chat_color, equipped_effect, is_banned, ban_reason, is_bot,
  recovery_email_verified_at, game_wins, is_premium
) ON public.profiles TO authenticated;
-- auth_email + recovery_email intentionally excluded; SECURITY DEFINER RPCs
-- (lookup_auth_email, get_my_recovery_status, issue_recovery_code, etc.) still see them.

-- 3) rooms: hide password_hash; everything else stays readable
REVOKE SELECT ON public.rooms FROM authenticated, anon;
GRANT SELECT (id, name, description, owner_id, created_at, type, max_members, is_active)
  ON public.rooms TO authenticated;

-- 4) game_rounds: hide secret column from clients
REVOKE SELECT ON public.game_rounds FROM authenticated, anon;
GRANT SELECT (id, status, started_at, deadline_at, ended_at, winner_id, winner_name, winner_value)
  ON public.game_rounds TO authenticated;

-- 5) Remove game_rounds from realtime publication so CDC cannot leak `secret`.
-- Clients still get round lifecycle updates via game_system_messages (already published).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='game_rounds'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.game_rounds';
  END IF;
END $$;