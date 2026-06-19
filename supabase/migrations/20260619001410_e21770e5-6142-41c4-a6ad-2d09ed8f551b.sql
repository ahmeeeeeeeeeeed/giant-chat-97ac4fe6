
-- 1) dm_devices: track active devices per user
CREATE TABLE public.dm_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_devices TO authenticated;
GRANT ALL ON public.dm_devices TO service_role;
ALTER TABLE public.dm_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_devices owner manage" ON public.dm_devices
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Anyone authenticated can read devices (needed to know recipient devices for delivery tracking)
CREATE POLICY "dm_devices read all auth" ON public.dm_devices
  FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_dm_devices_user_lastseen ON public.dm_devices(user_id, last_seen DESC);

-- 2) dm_deliveries: per-device acknowledgement of a message
CREATE TABLE public.dm_deliveries (
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, device_id)
);
GRANT SELECT, INSERT, DELETE ON public.dm_deliveries TO authenticated;
GRANT ALL ON public.dm_deliveries TO service_role;
ALTER TABLE public.dm_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_deliveries insert own" ON public.dm_deliveries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dm_deliveries read involved" ON public.dm_deliveries
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = message_id AND dm.sender_id = auth.uid()
    )
  );
CREATE INDEX idx_dm_deliveries_message ON public.dm_deliveries(message_id);

-- 3) Trigger: when a delivery is recorded, check if all active recipient devices have ack'd.
-- "Active device" = last_seen within 30 days. If recipient has no active devices, single ack suffices.
CREATE OR REPLACE FUNCTION public.dm_check_full_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receiver uuid;
  v_active_count int;
  v_ack_count int;
BEGIN
  SELECT receiver_id INTO v_receiver
  FROM public.direct_messages WHERE id = NEW.message_id;
  IF v_receiver IS NULL THEN
    -- Message already gone; nothing to do.
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.dm_devices
  WHERE user_id = v_receiver
    AND last_seen > now() - interval '30 days';

  SELECT COUNT(DISTINCT device_id) INTO v_ack_count
  FROM public.dm_deliveries
  WHERE message_id = NEW.message_id AND user_id = v_receiver;

  -- If no registered active devices, one ack is enough.
  IF v_active_count = 0 OR v_ack_count >= v_active_count THEN
    DELETE FROM public.direct_messages WHERE id = NEW.message_id;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_dm_check_full_delivery
AFTER INSERT ON public.dm_deliveries
FOR EACH ROW EXECUTE FUNCTION public.dm_check_full_delivery();

-- 4) Realtime: ensure delete events on direct_messages are broadcast so sender can mark "delivered"
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_deliveries;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) app_updates: per-version release notes (manual entry by admin)
ALTER TABLE public.app_updates
  ADD COLUMN IF NOT EXISTS release_notes_ar text,
  ADD COLUMN IF NOT EXISTS release_notes_en text;
