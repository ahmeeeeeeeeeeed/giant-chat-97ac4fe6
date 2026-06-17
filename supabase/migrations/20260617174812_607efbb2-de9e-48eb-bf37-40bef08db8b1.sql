
-- ====== calls ======
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  call_type text NOT NULL CHECK (call_type IN ('audio','video')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','accepted','rejected','missed','ended','busy','failed','canceled')),
  end_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX calls_caller_idx ON public.calls(caller_id, started_at DESC);
CREATE INDEX calls_callee_idx ON public.calls(callee_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own calls" ON public.calls
  FOR SELECT TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "caller can insert" ON public.calls
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "participants update" ON public.calls
  FOR UPDATE TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.calls_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER calls_updated_at BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.calls_set_updated_at();

-- ====== call_signals ======
CREATE TABLE public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('offer','answer','ice','hangup','ringing','accept','reject','busy')),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX call_signals_to_idx ON public.call_signals(to_user, created_at DESC);
CREATE INDEX call_signals_call_idx ON public.call_signals(call_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.call_signals TO authenticated;
GRANT ALL ON public.call_signals TO service_role;

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see own signals" ON public.call_signals
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

CREATE POLICY "send signals from self" ON public.call_signals
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = from_user
    AND EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = call_id
        AND (c.caller_id = auth.uid() OR c.callee_id = auth.uid())
        AND (c.caller_id = to_user OR c.callee_id = to_user)
    )
  );

CREATE POLICY "delete own signals" ON public.call_signals
  FOR DELETE TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.call_signals REPLICA IDENTITY FULL;
