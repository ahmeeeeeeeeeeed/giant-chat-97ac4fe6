ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_dm_receiver_undelivered
  ON public.direct_messages (receiver_id, sender_id)
  WHERE delivered_at IS NULL;

CREATE OR REPLACE FUNCTION public.dm_mark_delivered(_peer uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.direct_messages
     SET delivered_at = now()
   WHERE receiver_id = auth.uid()
     AND sender_id = _peer
     AND delivered_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.dm_mark_delivered(uuid) TO authenticated;