
CREATE OR REPLACE FUNCTION public.daily_task_meta(_kind text)
 RETURNS TABLE(target integer, reward integer, label text)
 LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT t.target, t.reward, t.label FROM (VALUES
    ('daily_login',     1,  50, 'تسجيل الدخول اليومي'),
    ('send_messages',  10, 100, 'إرسال 10 رسائل'),
    ('join_rooms',      3, 100, 'دخول 3 غرف مختلفة'),
    ('react_messages',  5, 100, 'إرسال 5 تفاعلات'),
    ('publish_post',    1, 150, 'نشر بوست في المجتمع'),
    ('publish_story',   1, 120, 'نشر قصة')
  ) AS t(k, target, reward, label)
  WHERE t.k = _kind;
$$;

CREATE OR REPLACE FUNCTION public.get_my_daily_tasks()
 RETURNS TABLE(kind text, label text, target integer, reward integer, progress integer, claimed boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH kinds(k) AS (VALUES ('daily_login'),('send_messages'),('join_rooms'),('react_messages'),('publish_post'),('publish_story'))
  SELECT k.k, m.label, m.target, m.reward,
         COALESCE(p.progress, 0), COALESCE(p.claimed, false)
  FROM kinds k
  CROSS JOIN LATERAL public.daily_task_meta(k.k) m
  LEFT JOIN public.user_daily_progress p
    ON p.user_id = auth.uid() AND p.task_kind = k.k
   AND p.day = (now() AT TIME ZONE 'UTC')::date;
$$;

CREATE OR REPLACE FUNCTION public.publish_story(_content text, _media_url text, _media_type text, _background text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF (_content IS NULL OR length(btrim(_content))=0) AND _media_url IS NULL THEN
    RAISE EXCEPTION 'empty_story';
  END IF;
  IF _media_type IS NOT NULL AND _media_type NOT IN ('image','video') THEN
    RAISE EXCEPTION 'invalid_media_type';
  END IF;
  INSERT INTO public.stories(user_id, content, media_url, media_type, background)
    VALUES (_uid, NULLIF(btrim(COALESCE(_content,'')),''), _media_url, _media_type, _background)
    RETURNING id INTO _id;
  BEGIN PERFORM public.record_daily_action('publish_story', 1); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN _id;
END $$;
