-- 1) Extend room_messages with type + media
DO $$ BEGIN
  CREATE TYPE public.message_type AS ENUM ('text','image','voice');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.room_messages
  ADD COLUMN IF NOT EXISTS message_type public.message_type NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_duration_ms integer;

-- Allow empty content for media-only messages
ALTER TABLE public.room_messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.room_messages ALTER COLUMN content SET DEFAULT '';

-- 2) Auto-delete messages when last member leaves a room
CREATE OR REPLACE FUNCTION public.cleanup_empty_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = OLD.room_id) THEN
    DELETE FROM public.room_messages WHERE room_id = OLD.room_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_empty_room ON public.room_members;
CREATE TRIGGER trg_cleanup_empty_room
AFTER DELETE ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.cleanup_empty_room();

-- 3) Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('room-media', 'room-media', true)
ON CONFLICT (id) DO NOTHING;

-- Avatars policies
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "users upload own avatar" ON storage.objects;
CREATE POLICY "users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "users update own avatar" ON storage.objects;
CREATE POLICY "users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "users delete own avatar" ON storage.objects;
CREATE POLICY "users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Room media policies
DROP POLICY IF EXISTS "room-media public read" ON storage.objects;
CREATE POLICY "room-media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'room-media');

DROP POLICY IF EXISTS "members upload room media" ON storage.objects;
CREATE POLICY "members upload room media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'room-media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "owners delete own room media" ON storage.objects;
CREATE POLICY "owners delete own room media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'room-media' AND auth.uid()::text = (storage.foldername(name))[1]);