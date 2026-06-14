-- Hide sensitive columns from authenticated/anon by switching the table-wide
-- SELECT privilege to column-level SELECT that omits the secret columns.
-- All server-side RPCs (SECURITY DEFINER) continue to access these columns
-- because column privileges do not affect function bodies.

-- 1) game_rounds.secret  →  hide from clients
REVOKE SELECT ON public.game_rounds FROM authenticated, anon;
GRANT SELECT (
  id, status, started_at, deadline_at, ended_at,
  winner_id, winner_name, winner_value
) ON public.game_rounds TO authenticated;

-- 2) profiles.recovery_email / recovery_email_verified_at / ban_reason
--    Already exposed via SECURITY DEFINER RPCs (get_my_recovery_status,
--    admin_list_users) so removing direct column SELECT is safe.
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (
  id, username, avatar_url, bio, last_seen_at, created_at,
  points, gender, country, hide_last_seen, dm_locked, profile_views,
  equipped_badge, equipped_name_color, equipped_chat_color, equipped_effect,
  is_banned, is_bot, game_wins
) ON public.profiles TO authenticated;

-- 3) bot_subagents.password  →  bcrypt hash, no client needs to read it
REVOKE SELECT ON public.bot_subagents FROM authenticated, anon;
GRANT SELECT (id, owner_id, name, room_id, silent, created_at)
  ON public.bot_subagents TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bot_subagents TO authenticated;

-- 4) rooms.password_hash  →  bcrypt hash, joining a room uses the
--    SECURITY DEFINER room_join RPC which still reads it.
REVOKE SELECT ON public.rooms FROM authenticated, anon;
GRANT SELECT (
  id, name, description, owner_id, created_at,
  type, max_members, is_active
) ON public.rooms TO authenticated;
-- The "create-room" form and admin tooling still need to write password_hash:
GRANT INSERT, UPDATE, DELETE ON public.rooms TO authenticated;

-- Service role keeps full access (edge functions, admin code).
GRANT ALL ON public.game_rounds, public.profiles, public.bot_subagents, public.rooms
  TO service_role;