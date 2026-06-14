
-- Track game wins per user
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS game_wins integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_game_win(_game text, _points integer DEFAULT 5)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _points IS NULL OR _points < 0 OR _points > 50 THEN _points := 5; END IF;
  UPDATE public.profiles
    SET game_wins = COALESCE(game_wins,0) + 1,
        points = COALESCE(points,0) + _points
    WHERE id = _uid;
END $$;

GRANT EXECUTE ON FUNCTION public.record_game_win(text, integer) TO authenticated;

-- Leaderboard of top game winners (all-time)
CREATE OR REPLACE FUNCTION public.get_top_game_winners(_limit integer DEFAULT 20)
RETURNS TABLE(user_id uuid, username text, avatar_url text, wins integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, username, avatar_url, game_wins
  FROM public.profiles
  WHERE COALESCE(game_wins,0) > 0
  ORDER BY game_wins DESC, username ASC
  LIMIT GREATEST(1, COALESCE(_limit,20));
$$;

GRANT EXECUTE ON FUNCTION public.get_top_game_winners(integer) TO authenticated, anon;
