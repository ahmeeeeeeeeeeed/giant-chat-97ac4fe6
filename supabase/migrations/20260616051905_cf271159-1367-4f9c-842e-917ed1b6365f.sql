
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  media_url text,
  media_type text CHECK (media_type IN ('image','video')),
  background text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS stories_user_idx ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON public.stories(expires_at);

GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select_active" ON public.stories
  FOR SELECT TO authenticated USING (expires_at > now());
CREATE POLICY "stories_insert_self" ON public.stories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_delete_own_or_admin" ON public.stories
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_views_select" ON public.story_views
  FOR SELECT TO authenticated USING (
    viewer_id = auth.uid() OR EXISTS(SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );
CREATE POLICY "story_views_insert_self" ON public.story_views
  FOR INSERT TO authenticated WITH CHECK (viewer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.publish_story(_content text, _media_url text, _media_type text, _background text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _sid uuid;
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
    RETURNING id INTO _sid;
  BEGIN PERFORM public.record_daily_action('publish_post', 1); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN _sid;
END $$;

CREATE OR REPLACE FUNCTION public.get_active_stories()
RETURNS TABLE(user_id uuid, username text, avatar_url text, equipped_frame uuid, story_count bigint, latest_at timestamptz, has_unseen boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.avatar_url, p.equipped_frame,
    count(s.id), max(s.created_at),
    bool_or(NOT EXISTS(SELECT 1 FROM public.story_views v WHERE v.story_id = s.id AND v.viewer_id = auth.uid()))
  FROM public.stories s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.expires_at > now()
  GROUP BY p.id, p.username, p.avatar_url, p.equipped_frame
  ORDER BY max(s.created_at) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stories(_user uuid)
RETURNS SETOF public.stories
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.stories WHERE user_id = _user AND expires_at > now() ORDER BY created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.view_story(_story uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.story_views(story_id, viewer_id) VALUES (_story, auth.uid()) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.user_has_active_story(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.stories WHERE user_id = _user AND expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_stories()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.stories WHERE expires_at <= now();
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    BEGIN PERFORM cron.unschedule('cleanup-expired-stories'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule('cleanup-expired-stories','*/30 * * * *', 'SELECT public.cleanup_expired_stories();');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
