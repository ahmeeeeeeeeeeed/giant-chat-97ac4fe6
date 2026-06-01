
-- Add new profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male','female')),
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS hide_last_seen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dm_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_views INTEGER NOT NULL DEFAULT 0;

-- Profile visits tracking
CREATE TABLE IF NOT EXISTS public.profile_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  viewer_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, viewer_id)
);

GRANT SELECT, INSERT ON public.profile_visits TO authenticated;
GRANT ALL ON public.profile_visits TO service_role;

ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read their visits"
  ON public.profile_visits FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "viewers create visits"
  ON public.profile_visits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

-- Increment profile view (unique per viewer)
CREATE OR REPLACE FUNCTION public.increment_profile_view(_target UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted BOOLEAN;
  new_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = _target THEN
    SELECT profile_views INTO new_count FROM public.profiles WHERE id = _target;
    RETURN COALESCE(new_count, 0);
  END IF;

  INSERT INTO public.profile_visits (profile_id, viewer_id)
  VALUES (_target, auth.uid())
  ON CONFLICT (profile_id, viewer_id) DO NOTHING
  RETURNING true INTO inserted;

  IF inserted THEN
    UPDATE public.profiles SET profile_views = profile_views + 1
    WHERE id = _target
    RETURNING profile_views INTO new_count;
  ELSE
    SELECT profile_views INTO new_count FROM public.profiles WHERE id = _target;
  END IF;
  RETURN COALESCE(new_count, 0);
END;
$$;

-- Enforce DM lock: only friends can DM a locked user
CREATE OR REPLACE FUNCTION public.enforce_dm_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked BOOLEAN;
  is_friend BOOLEAN;
BEGIN
  IF NEW.sender_id = NEW.receiver_id THEN RETURN NEW; END IF;
  SELECT dm_locked INTO locked FROM public.profiles WHERE id = NEW.receiver_id;
  IF COALESCE(locked, false) = false THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = NEW.sender_id AND addressee_id = NEW.receiver_id)
        OR (requester_id = NEW.receiver_id AND addressee_id = NEW.sender_id))
  ) INTO is_friend;
  IF NOT is_friend THEN
    RAISE EXCEPTION 'recipient_dm_locked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_dm_lock ON public.direct_messages;
CREATE TRIGGER trg_enforce_dm_lock
BEFORE INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_dm_lock();
