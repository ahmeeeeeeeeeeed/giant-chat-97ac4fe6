
CREATE OR REPLACE FUNCTION public.daily_task_meta(_kind text)
RETURNS TABLE(target int, reward int, label text)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT t.target, t.reward, t.label FROM (VALUES
    ('daily_login',     1,  50, 'تسجيل الدخول اليومي'),
    ('send_messages',  10, 100, 'إرسال 10 رسائل'),
    ('join_rooms',      3, 100, 'دخول 3 غرف مختلفة'),
    ('react_messages',  5, 100, 'إرسال 5 تفاعلات'),
    ('publish_post',    1, 150, 'نشر بوست في المجتمع')
  ) AS t(k, target, reward, label)
  WHERE t.k = _kind;
$$;

CREATE OR REPLACE FUNCTION public.get_my_daily_tasks()
RETURNS TABLE(kind text, label text, target int, reward int, progress int, claimed boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  WITH kinds(k) AS (VALUES ('daily_login'),('send_messages'),('join_rooms'),('react_messages'),('publish_post'))
  SELECT k.k, m.label, m.target, m.reward,
         COALESCE(p.progress, 0), COALESCE(p.claimed, false)
  FROM kinds k
  CROSS JOIN LATERAL public.daily_task_meta(k.k) m
  LEFT JOIN public.user_daily_progress p
    ON p.user_id = auth.uid() AND p.task_kind = k.k
   AND p.day = (now() AT TIME ZONE 'UTC')::date;
$$;

CREATE OR REPLACE FUNCTION public.claim_daily_reward(_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _meta record; _row record;
  _old_pts int; _new_pts int; _old_lvl int; _new_lvl int;
  _uname text; _roll float;
  _gift_pts int := 0; _gift_name text := NULL; _level_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _meta FROM public.daily_task_meta(_kind);
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_task'; END IF;

  SELECT * INTO _row FROM public.user_daily_progress
   WHERE user_id = _uid AND task_kind = _kind AND day = _today FOR UPDATE;
  IF NOT FOUND OR _row.progress < _meta.target THEN RAISE EXCEPTION 'task_not_completed'; END IF;
  IF _row.claimed THEN RAISE EXCEPTION 'already_claimed'; END IF;

  SELECT points, username INTO _old_pts, _uname FROM public.profiles WHERE id = _uid;
  _old_pts := COALESCE(_old_pts, 0);
  _old_lvl := public.compute_level(_old_pts);

  _roll := random();
  IF _roll < 0.03 THEN _gift_pts := 2000; _gift_name := '🏆 كنز أسطوري نادر جداً';
  ELSIF _roll < 0.12 THEN _gift_pts := 800; _gift_name := '💎 جوهرة نادرة';
  ELSIF _roll < 0.30 THEN _gift_pts := 200; _gift_name := '🎁 هدية مميزة';
  END IF;

  _new_pts := _old_pts + _meta.reward + _gift_pts;
  UPDATE public.profiles SET points = _new_pts WHERE id = _uid;
  UPDATE public.user_daily_progress SET claimed = true, claimed_at = now()
   WHERE user_id = _uid AND task_kind = _kind AND day = _today;

  _new_lvl := public.compute_level(_new_pts);
  SELECT name INTO _level_name FROM public.level_thresholds WHERE level = _new_lvl;

  IF _gift_name IS NOT NULL AND _gift_pts >= 800 THEN
    INSERT INTO public.announcements(content, created_by)
    VALUES ('🎉 المستخدم ' || COALESCE(_uname,'مجهول') || ' فاز بـ ' || _gift_name
      || ' (+' || _gift_pts || ' نقطة) ووصل إلى مستوى ' || _new_lvl || ' — ' || COALESCE(_level_name,''), _uid);
  ELSIF _new_lvl > _old_lvl THEN
    INSERT INTO public.announcements(content, created_by)
    VALUES ('⭐ المستخدم ' || COALESCE(_uname,'مجهول') || ' ترقّى إلى المستوى ' || _new_lvl
      || ' — ' || COALESCE(_level_name,''), _uid);
  END IF;

  RETURN jsonb_build_object(
    'reward_points', _meta.reward, 'gift_points', _gift_pts, 'gift_name', _gift_name,
    'total_points', _new_pts, 'old_level', _old_lvl, 'new_level', _new_lvl,
    'level_name', _level_name, 'level_up', _new_lvl > _old_lvl);
END $$;
