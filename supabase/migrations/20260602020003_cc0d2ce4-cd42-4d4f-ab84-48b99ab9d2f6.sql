
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_for uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE TABLE IF NOT EXISTS public.dm_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.dm_blocks TO authenticated;
GRANT ALL ON public.dm_blocks TO service_role;
ALTER TABLE public.dm_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own blocks" ON public.dm_blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "users add own blocks" ON public.dm_blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "users remove own blocks" ON public.dm_blocks FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

CREATE TABLE IF NOT EXISTS public.dm_mutes (
  muter_id uuid NOT NULL,
  muted_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id)
);
GRANT SELECT, INSERT, DELETE ON public.dm_mutes TO authenticated;
GRANT ALL ON public.dm_mutes TO service_role;
ALTER TABLE public.dm_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own mutes" ON public.dm_mutes FOR SELECT TO authenticated
  USING (auth.uid() = muter_id);
CREATE POLICY "users add own mutes" ON public.dm_mutes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = muter_id);
CREATE POLICY "users remove own mutes" ON public.dm_mutes FOR DELETE TO authenticated
  USING (auth.uid() = muter_id);

-- Block trigger: prevent DM if receiver blocked sender OR sender blocked receiver
CREATE OR REPLACE FUNCTION public.enforce_dm_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dm_blocks
    WHERE (blocker_id = NEW.receiver_id AND blocked_id = NEW.sender_id)
       OR (blocker_id = NEW.sender_id AND blocked_id = NEW.receiver_id))
  THEN
    RAISE EXCEPTION 'dm_blocked';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dm_enforce_block ON public.direct_messages;
CREATE TRIGGER dm_enforce_block BEFORE INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dm_block();

-- Update SELECT policy: hide messages "deleted for me"
DROP POLICY IF EXISTS "dm read own" ON public.direct_messages;
CREATE POLICY "dm read own" ON public.direct_messages FOR SELECT TO authenticated
USING (
  (auth.uid() = sender_id OR auth.uid() = receiver_id)
  AND NOT (auth.uid() = ANY(deleted_for))
);

CREATE OR REPLACE FUNCTION public.dm_delete_for_me(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.direct_messages
    SET deleted_for = array_append(deleted_for, auth.uid())
    WHERE id = _id
      AND (auth.uid() = sender_id OR auth.uid() = receiver_id)
      AND NOT (auth.uid() = ANY(deleted_for));
END $$;

CREATE OR REPLACE FUNCTION public.dm_delete_for_all(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.direct_messages WHERE id = _id AND sender_id = auth.uid();
END $$;
