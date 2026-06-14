
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_read_all" ON public.announcements;
CREATE POLICY "announcements_read_all" ON public.announcements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "announcements_admin_write" ON public.announcements;
CREATE POLICY "announcements_admin_write" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS announcements_created_at_idx
  ON public.announcements (created_at DESC);

-- Make sure realtime delivers INSERTs for this table
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'announcements'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements';
  END IF;
END $$;

-- Update admin_broadcast so the announcement also lands in the global feed
CREATE OR REPLACE FUNCTION public.admin_broadcast(_text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := auth.uid();
  _content text;
  _clean text;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _text IS NULL OR length(btrim(_text)) = 0 THEN RAISE EXCEPTION 'Empty text'; END IF;
  _clean := btrim(_text);
  _content := '📢 إعلان من النظام: ' || _clean;

  -- Global feed (reaches users even outside any room)
  INSERT INTO public.announcements(content, created_by) VALUES (_clean, _admin);

  -- Also drop into every active room's chat
  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
  SELECT r.id, NULL, _content, 'system'::public.message_type,
         jsonb_build_object('kind','admin_broadcast')
  FROM public.rooms r
  WHERE r.is_active = true;
END $function$;
