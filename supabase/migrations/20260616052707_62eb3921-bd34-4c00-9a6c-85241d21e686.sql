
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

GRANT UPDATE ON public.stories TO authenticated;

DROP POLICY IF EXISTS "stories_select_active" ON public.stories;
CREATE POLICY "stories_select_active" ON public.stories
  FOR SELECT TO authenticated USING (
    expires_at > now() AND (NOT is_hidden OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  );

DROP POLICY IF EXISTS "stories_update_own_or_admin" ON public.stories;
CREATE POLICY "stories_update_own_or_admin" ON public.stories
  FOR UPDATE TO authenticated USING (
    auth.uid() = user_id OR public.has_role(auth.uid(),'admin')
  ) WITH CHECK (
    auth.uid() = user_id OR public.has_role(auth.uid(),'admin')
  );

-- Edit own story (within 24h)
CREATE OR REPLACE FUNCTION public.edit_story(
  _story uuid, _content text, _media_url text, _media_type text, _background text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _owner uuid; _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT user_id, expires_at INTO _owner, _exp FROM public.stories WHERE id = _story;
  IF _owner IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _owner <> _uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _exp <= now() THEN RAISE EXCEPTION 'expired'; END IF;
  IF (_content IS NULL OR length(btrim(_content))=0) AND _media_url IS NULL THEN
    RAISE EXCEPTION 'empty_story';
  END IF;
  IF _media_type IS NOT NULL AND _media_type NOT IN ('image','video') THEN
    RAISE EXCEPTION 'invalid_media_type';
  END IF;
  UPDATE public.stories SET
    content = NULLIF(btrim(COALESCE(_content,'')),''),
    media_url = _media_url,
    media_type = _media_type,
    background = _background,
    updated_at = now()
  WHERE id = _story;
END $$;

-- Update active stories listing to filter hidden for non-admin
CREATE OR REPLACE FUNCTION public.get_active_stories()
RETURNS TABLE(user_id uuid, username text, avatar_url text, equipped_frame uuid, story_count bigint, latest_at timestamptz, has_unseen boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.avatar_url, p.equipped_frame,
    count(s.id), max(s.created_at),
    bool_or(NOT EXISTS(SELECT 1 FROM public.story_views v WHERE v.story_id = s.id AND v.viewer_id = auth.uid()))
  FROM public.stories s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.expires_at > now()
    AND (NOT s.is_hidden OR s.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  GROUP BY p.id, p.username, p.avatar_url, p.equipped_frame
  ORDER BY max(s.created_at) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stories(_user uuid)
RETURNS SETOF public.stories
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.stories
  WHERE user_id = _user AND expires_at > now()
    AND (NOT is_hidden OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ORDER BY created_at ASC;
$$;

-- Admin: list all stories with stats
CREATE OR REPLACE FUNCTION public.admin_list_all_stories()
RETURNS TABLE(
  id uuid, user_id uuid, username text, avatar_url text,
  content text, media_url text, media_type text, background text,
  is_hidden boolean, created_at timestamptz, updated_at timestamptz, expires_at timestamptz,
  views_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT s.id, s.user_id, p.username, p.avatar_url,
      s.content, s.media_url, s.media_type, s.background,
      s.is_hidden, s.created_at, s.updated_at, s.expires_at,
      (SELECT count(*) FROM public.story_views v WHERE v.story_id = s.id)
    FROM public.stories s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    ORDER BY s.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_story_hidden(_story uuid, _hidden boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.stories SET is_hidden = _hidden, updated_at = now() WHERE id = _story;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_story(_story uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.stories WHERE id = _story;
END $$;

CREATE OR REPLACE FUNCTION public.admin_stories_stats()
RETURNS TABLE(total bigint, active bigint, hidden bigint, total_views bigint, total_publishers bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT
    (SELECT count(*) FROM public.stories),
    (SELECT count(*) FROM public.stories WHERE expires_at > now()),
    (SELECT count(*) FROM public.stories WHERE is_hidden = true),
    (SELECT count(*) FROM public.story_views),
    (SELECT count(DISTINCT user_id) FROM public.stories);
END $$;
