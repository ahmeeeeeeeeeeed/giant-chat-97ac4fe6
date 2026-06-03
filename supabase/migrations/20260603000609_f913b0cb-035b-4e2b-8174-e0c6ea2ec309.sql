CREATE TABLE public.room_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.room_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX idx_rmr_message ON public.room_message_reactions(message_id);

GRANT SELECT, INSERT, DELETE ON public.room_message_reactions TO authenticated;
GRANT ALL ON public.room_message_reactions TO service_role;

ALTER TABLE public.room_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions readable by authenticated"
  ON public.room_message_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "users add own reactions"
  ON public.room_message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users remove own reactions"
  ON public.room_message_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_message_reactions;