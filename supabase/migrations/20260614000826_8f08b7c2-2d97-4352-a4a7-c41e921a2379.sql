
-- Weekly leaderboard functions. All scoped to the current ISO week (Mon..Sun)
-- via date_trunc('week', now()). Nothing is stored — totals naturally reset
-- each week. Security definer so RLS on source tables doesn't block aggregation.

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboards(_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _week_start timestamptz := date_trunc('week', now());
  posters jsonb;
  spenders jsonb;
  overall jsonb;
BEGIN
  -- Top posters: posts authored + comments authored + reactions received on own posts
  WITH posts_cnt AS (
    SELECT author_id AS user_id, COUNT(*)::int AS posts
    FROM community_posts WHERE created_at >= _week_start GROUP BY author_id
  ),
  comments_cnt AS (
    SELECT author_id AS user_id, COUNT(*)::int AS comments
    FROM community_comments WHERE created_at >= _week_start GROUP BY author_id
  ),
  reacts_received AS (
    SELECT p.author_id AS user_id, COUNT(*)::int AS rx
    FROM community_reactions r
    JOIN community_posts p ON p.id = r.post_id
    WHERE r.created_at >= _week_start
    GROUP BY p.author_id
  ),
  agg AS (
    SELECT u, COALESCE(SUM(posts),0) AS posts, COALESCE(SUM(comments),0) AS comments, COALESCE(SUM(rx),0) AS rx
    FROM (
      SELECT user_id u, posts, 0 AS comments, 0 AS rx FROM posts_cnt
      UNION ALL SELECT user_id, 0, comments, 0 FROM comments_cnt
      UNION ALL SELECT user_id, 0, 0, rx FROM reacts_received
    ) s GROUP BY u
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', a.u,
    'username', pr.username,
    'avatar_url', pr.avatar_url,
    'score', (a.posts * 5 + a.comments * 2 + a.rx)::int,
    'breakdown', jsonb_build_object('posts', a.posts, 'comments', a.comments, 'reactions_received', a.rx)
  ) ORDER BY (a.posts * 5 + a.comments * 2 + a.rx) DESC), '[]'::jsonb)
  INTO posters
  FROM (
    SELECT * FROM agg ORDER BY (posts * 5 + comments * 2 + rx) DESC LIMIT _limit
  ) a
  JOIN profiles pr ON pr.id = a.u
  WHERE COALESCE(pr.is_bot, false) = false;

  -- Top spenders: sum of shop_items.price for items acquired this week
  WITH bought AS (
    SELECT inv.user_id, COALESCE(SUM(si.price),0)::int AS spent, COUNT(*)::int AS items
    FROM user_inventory inv
    JOIN shop_items si ON si.id = inv.item_id
    WHERE inv.acquired_at >= _week_start
    GROUP BY inv.user_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', b.user_id,
    'username', pr.username,
    'avatar_url', pr.avatar_url,
    'score', b.spent,
    'breakdown', jsonb_build_object('points_spent', b.spent, 'items', b.items, 'total_points', pr.points)
  ) ORDER BY b.spent DESC), '[]'::jsonb)
  INTO spenders
  FROM (SELECT * FROM bought ORDER BY spent DESC LIMIT _limit) b
  JOIN profiles pr ON pr.id = b.user_id
  WHERE COALESCE(pr.is_bot, false) = false;

  -- Top overall: rooms activity + posts + comments + reactions given/received + spending
  WITH room_msgs AS (
    SELECT user_id, COUNT(*)::int AS msgs FROM room_messages
    WHERE created_at >= _week_start AND user_id IS NOT NULL GROUP BY user_id
  ),
  posts_cnt AS (
    SELECT author_id AS user_id, COUNT(*)::int AS posts
    FROM community_posts WHERE created_at >= _week_start GROUP BY author_id
  ),
  comments_cnt AS (
    SELECT author_id AS user_id, COUNT(*)::int AS comments
    FROM community_comments WHERE created_at >= _week_start GROUP BY author_id
  ),
  rx_given AS (
    SELECT user_id, COUNT(*)::int AS rx FROM community_reactions
    WHERE created_at >= _week_start GROUP BY user_id
  ),
  rx_recv AS (
    SELECT p.author_id AS user_id, COUNT(*)::int AS rx
    FROM community_reactions r JOIN community_posts p ON p.id = r.post_id
    WHERE r.created_at >= _week_start GROUP BY p.author_id
  ),
  bought AS (
    SELECT inv.user_id, COALESCE(SUM(si.price),0)::int AS spent
    FROM user_inventory inv JOIN shop_items si ON si.id = inv.item_id
    WHERE inv.acquired_at >= _week_start GROUP BY inv.user_id
  ),
  agg AS (
    SELECT u,
      COALESCE(SUM(msgs),0) AS msgs,
      COALESCE(SUM(posts),0) AS posts,
      COALESCE(SUM(comments),0) AS comments,
      COALESCE(SUM(rx_g),0) AS rx_g,
      COALESCE(SUM(rx_r),0) AS rx_r,
      COALESCE(SUM(spent),0) AS spent
    FROM (
      SELECT user_id u, msgs, 0 posts, 0 comments, 0 rx_g, 0 rx_r, 0 spent FROM room_msgs
      UNION ALL SELECT user_id, 0, posts, 0, 0, 0, 0 FROM posts_cnt
      UNION ALL SELECT user_id, 0, 0, comments, 0, 0, 0 FROM comments_cnt
      UNION ALL SELECT user_id, 0, 0, 0, rx, 0, 0 FROM rx_given
      UNION ALL SELECT user_id, 0, 0, 0, 0, rx, 0 FROM rx_recv
      UNION ALL SELECT user_id, 0, 0, 0, 0, 0, spent FROM bought
    ) s GROUP BY u
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', a.u,
    'username', pr.username,
    'avatar_url', pr.avatar_url,
    'score', (a.msgs + a.posts * 5 + a.comments * 2 + a.rx_g + a.rx_r * 2 + (a.spent / 10))::int,
    'breakdown', jsonb_build_object(
      'room_messages', a.msgs, 'posts', a.posts, 'comments', a.comments,
      'reactions_given', a.rx_g, 'reactions_received', a.rx_r, 'points_spent', a.spent
    )
  ) ORDER BY (a.msgs + a.posts * 5 + a.comments * 2 + a.rx_g + a.rx_r * 2 + (a.spent / 10)) DESC), '[]'::jsonb)
  INTO overall
  FROM (
    SELECT * FROM agg
    ORDER BY (msgs + posts * 5 + comments * 2 + rx_g + rx_r * 2 + (spent / 10)) DESC
    LIMIT _limit
  ) a
  JOIN profiles pr ON pr.id = a.u
  WHERE COALESCE(pr.is_bot, false) = false;

  RETURN jsonb_build_object(
    'week_start', _week_start,
    'week_end', _week_start + interval '7 days',
    'posters', posters,
    'spenders', spenders,
    'overall', overall
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboards(integer) TO authenticated, anon;

-- Per-user weekly rank summary (for profile badges)
CREATE OR REPLACE FUNCTION public.get_weekly_user_stats(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _week_start timestamptz := date_trunc('week', now());
  posters_rank int;
  spenders_rank int;
  overall_rank int;
  poster_score int;
  spender_score int;
  overall_score int;
BEGIN
  -- posters
  WITH posts_cnt AS (SELECT author_id u, COUNT(*) c FROM community_posts WHERE created_at >= _week_start GROUP BY author_id),
       comments_cnt AS (SELECT author_id u, COUNT(*) c FROM community_comments WHERE created_at >= _week_start GROUP BY author_id),
       rx_recv AS (SELECT p.author_id u, COUNT(*) c FROM community_reactions r JOIN community_posts p ON p.id = r.post_id WHERE r.created_at >= _week_start GROUP BY p.author_id),
       agg AS (
         SELECT u,
           COALESCE((SELECT c FROM posts_cnt WHERE u = a.u),0) * 5 +
           COALESCE((SELECT c FROM comments_cnt WHERE u = a.u),0) * 2 +
           COALESCE((SELECT c FROM rx_recv WHERE u = a.u),0) AS score
         FROM (SELECT DISTINCT u FROM (SELECT u FROM posts_cnt UNION SELECT u FROM comments_cnt UNION SELECT u FROM rx_recv) x) a
       )
  SELECT score, (SELECT COUNT(*)+1 FROM agg WHERE score > x.score)
  INTO poster_score, posters_rank
  FROM agg x WHERE u = _user;

  -- spenders
  WITH bought AS (SELECT inv.user_id u, COALESCE(SUM(si.price),0)::int s
                  FROM user_inventory inv JOIN shop_items si ON si.id = inv.item_id
                  WHERE inv.acquired_at >= _week_start GROUP BY inv.user_id)
  SELECT s, (SELECT COUNT(*)+1 FROM bought WHERE s > x.s)
  INTO spender_score, spenders_rank
  FROM bought x WHERE u = _user;

  -- overall
  WITH room_msgs AS (SELECT user_id u, COUNT(*) c FROM room_messages WHERE created_at >= _week_start AND user_id IS NOT NULL GROUP BY user_id),
       posts_cnt AS (SELECT author_id u, COUNT(*) c FROM community_posts WHERE created_at >= _week_start GROUP BY author_id),
       comments_cnt AS (SELECT author_id u, COUNT(*) c FROM community_comments WHERE created_at >= _week_start GROUP BY author_id),
       rx_g AS (SELECT user_id u, COUNT(*) c FROM community_reactions WHERE created_at >= _week_start GROUP BY user_id),
       rx_r AS (SELECT p.author_id u, COUNT(*) c FROM community_reactions r JOIN community_posts p ON p.id = r.post_id WHERE r.created_at >= _week_start GROUP BY p.author_id),
       bought AS (SELECT inv.user_id u, COALESCE(SUM(si.price),0)::int s FROM user_inventory inv JOIN shop_items si ON si.id = inv.item_id WHERE inv.acquired_at >= _week_start GROUP BY inv.user_id),
       agg AS (
         SELECT u,
           COALESCE((SELECT c FROM room_msgs WHERE u = a.u),0) +
           COALESCE((SELECT c FROM posts_cnt WHERE u = a.u),0) * 5 +
           COALESCE((SELECT c FROM comments_cnt WHERE u = a.u),0) * 2 +
           COALESCE((SELECT c FROM rx_g WHERE u = a.u),0) +
           COALESCE((SELECT c FROM rx_r WHERE u = a.u),0) * 2 +
           (COALESCE((SELECT s FROM bought WHERE u = a.u),0) / 10) AS score
         FROM (SELECT DISTINCT u FROM (
           SELECT u FROM room_msgs UNION SELECT u FROM posts_cnt UNION SELECT u FROM comments_cnt
           UNION SELECT u FROM rx_g UNION SELECT u FROM rx_r UNION SELECT u FROM bought) x) a
       )
  SELECT score, (SELECT COUNT(*)+1 FROM agg WHERE score > x.score)
  INTO overall_score, overall_rank
  FROM agg x WHERE u = _user;

  RETURN jsonb_build_object(
    'week_start', _week_start,
    'posters', jsonb_build_object('rank', posters_rank, 'score', COALESCE(poster_score,0)),
    'spenders', jsonb_build_object('rank', spenders_rank, 'score', COALESCE(spender_score,0)),
    'overall', jsonb_build_object('rank', overall_rank, 'score', COALESCE(overall_score,0))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_user_stats(uuid) TO authenticated, anon;
