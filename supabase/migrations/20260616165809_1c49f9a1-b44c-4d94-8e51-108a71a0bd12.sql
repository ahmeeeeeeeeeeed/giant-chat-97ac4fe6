
-- =================== story_reactions ===================
CREATE TABLE IF NOT EXISTS public.story_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_reactions TO authenticated;
GRANT ALL ON public.story_reactions TO service_role;

ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users read reactions"
ON public.story_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "users react as self"
ON public.story_reactions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own reaction"
ON public.story_reactions FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own reaction"
ON public.story_reactions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS story_reactions_story_idx ON public.story_reactions(story_id);

-- =================== react_to_story ===================
CREATE OR REPLACE FUNCTION public.react_to_story(_story uuid, _emoji text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _emoji IS NULL OR length(trim(_emoji)) = 0 THEN RAISE EXCEPTION 'emoji required'; END IF;
  INSERT INTO public.story_reactions (story_id, user_id, emoji)
  VALUES (_story, uid, _emoji)
  ON CONFLICT (story_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.unreact_to_story(_story uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.story_reactions WHERE story_id = _story AND user_id = auth.uid();
$$;

-- =================== comment_on_story ===================
CREATE OR REPLACE FUNCTION public.comment_on_story(_story uuid, _text text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  owner uuid;
  msg_id uuid;
  preview text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _text IS NULL OR length(trim(_text)) = 0 THEN RAISE EXCEPTION 'empty'; END IF;
  SELECT user_id, COALESCE(content, '📷 قصة') INTO owner, preview FROM public.stories WHERE id = _story;
  IF owner IS NULL THEN RAISE EXCEPTION 'story not found'; END IF;
  IF owner = uid THEN
    -- commenting on your own story does nothing
    RETURN NULL;
  END IF;
  INSERT INTO public.direct_messages (sender_id, receiver_id, content)
  VALUES (uid, owner, '💬 رد على قصتك: "' || left(preview, 60) || '"' || E'\n' || _text)
  RETURNING id INTO msg_id;
  RETURN msg_id;
END;
$$;

-- =================== get_story_reactions ===================
CREATE OR REPLACE FUNCTION public.get_story_reactions(_story uuid)
RETURNS TABLE(emoji text, count bigint, mine boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT emoji, count(*)::bigint AS count,
         bool_or(user_id = auth.uid()) AS mine
  FROM public.story_reactions
  WHERE story_id = _story
  GROUP BY emoji
  ORDER BY count DESC;
$$;

-- =================== delete_conversation ===================
CREATE OR REPLACE FUNCTION public.delete_conversation(_other uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  deleted_count integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  DELETE FROM public.direct_messages
  WHERE (sender_id = uid AND receiver_id = _other)
     OR (sender_id = _other AND receiver_id = uid);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.react_to_story(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unreact_to_story(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comment_on_story(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_story_reactions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_conversation(uuid) TO authenticated;
