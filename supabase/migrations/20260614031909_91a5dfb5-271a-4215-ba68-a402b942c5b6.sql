
CREATE TABLE IF NOT EXISTS public.level_thresholds (
  level int PRIMARY KEY,
  min_points int NOT NULL,
  name text NOT NULL
);
GRANT SELECT ON public.level_thresholds TO authenticated, anon;
GRANT ALL ON public.level_thresholds TO service_role;
ALTER TABLE public.level_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "levels_read_all" ON public.level_thresholds;
CREATE POLICY "levels_read_all" ON public.level_thresholds FOR SELECT USING (true);

INSERT INTO public.level_thresholds(level, min_points, name) VALUES
  (1,0,'مبتدئ'),(2,100,'نشيط'),(3,300,'متفاعل'),(4,700,'محترف'),
  (5,1500,'خبير'),(6,3000,'نجم'),(7,6000,'أسطورة'),(8,12000,'بطل'),
  (9,25000,'ملك الدردشة'),(10,50000,'إمبراطور Giant')
ON CONFLICT (level) DO UPDATE SET min_points = EXCLUDED.min_points, name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS public.user_daily_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_kind text NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  progress int NOT NULL DEFAULT 0,
  claimed boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  PRIMARY KEY (user_id, task_kind, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_daily_progress TO authenticated;
GRANT ALL ON public.user_daily_progress TO service_role;
ALTER TABLE public.user_daily_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "udp_self_read" ON public.user_daily_progress;
CREATE POLICY "udp_self_read" ON public.user_daily_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "udp_self_write" ON public.user_daily_progress;
CREATE POLICY "udp_self_write" ON public.user_daily_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS udp_day_idx ON public.user_daily_progress(day);

CREATE OR REPLACE FUNCTION public.compute_level(_points int)
RETURNS int LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(MAX(level), 1) FROM public.level_thresholds WHERE min_points <= COALESCE(_points, 0);
$$;
GRANT EXECUTE ON FUNCTION public.compute_level(int) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.daily_task_meta(_kind text)
RETURNS TABLE(target int, reward int, label text)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT t.target, t.reward, t.label FROM (VALUES
    ('daily_login',    1, 10, 'تسجيل الدخول اليومي'),
    ('send_messages',  10,20, 'إرسال 10 رسائل'),
    ('join_rooms',     3, 15, 'دخول 3 غرف مختلفة'),
    ('react_messages', 5, 15, 'إرسال 5 تفاعلات')
  ) AS t(k, target, reward, label)
  WHERE t.k = _kind;
$$;
GRANT EXECUTE ON FUNCTION public.daily_task_meta(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_daily_action(_kind text, _amount int DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _meta record;
  _today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN _amount := 1; END IF;
  SELECT * INTO _meta FROM public.daily_task_meta(_kind);
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.user_daily_progress(user_id, task_kind, day, progress)
  VALUES (_uid, _kind, _today, LEAST(_amount, _meta.target))
  ON CONFLICT (user_id, task_kind, day) DO UPDATE
    SET progress = LEAST(public.user_daily_progress.progress + _amount, _meta.target);
END $$;
GRANT EXECUTE ON FUNCTION public.record_daily_action(text, int) TO authenticated;

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
  IF _roll < 0.02 THEN _gift_pts := 500; _gift_name := '🏆 كنز أسطوري';
  ELSIF _roll < 0.10 THEN _gift_pts := 150; _gift_name := '💎 هدية نادرة';
  ELSIF _roll < 0.25 THEN _gift_pts := 40;  _gift_name := '🎁 هدية يومية';
  END IF;

  _new_pts := _old_pts + _meta.reward + _gift_pts;
  UPDATE public.profiles SET points = _new_pts WHERE id = _uid;
  UPDATE public.user_daily_progress SET claimed = true, claimed_at = now()
   WHERE user_id = _uid AND task_kind = _kind AND day = _today;

  _new_lvl := public.compute_level(_new_pts);
  SELECT name INTO _level_name FROM public.level_thresholds WHERE level = _new_lvl;

  IF _gift_name IS NOT NULL AND _gift_pts >= 150 THEN
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
GRANT EXECUTE ON FUNCTION public.claim_daily_reward(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_daily_tasks()
RETURNS TABLE(kind text, label text, target int, reward int, progress int, claimed boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  WITH kinds(k) AS (VALUES ('daily_login'),('send_messages'),('join_rooms'),('react_messages'))
  SELECT k.k, m.label, m.target, m.reward,
         COALESCE(p.progress, 0), COALESCE(p.claimed, false)
  FROM kinds k
  CROSS JOIN LATERAL public.daily_task_meta(k.k) m
  LEFT JOIN public.user_daily_progress p
    ON p.user_id = auth.uid() AND p.task_kind = k.k
   AND p.day = (now() AT TIME ZONE 'UTC')::date;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_daily_tasks() TO authenticated;
