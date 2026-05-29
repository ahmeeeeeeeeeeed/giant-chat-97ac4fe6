
-- 1) Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 2) DM media + read state
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS message_type public.message_type NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_duration_ms integer,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Allow receiver to update read_at on their messages
DROP POLICY IF EXISTS "dm update read" ON public.direct_messages;
CREATE POLICY "dm update read" ON public.direct_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

CREATE INDEX IF NOT EXISTS idx_dm_receiver_unread
  ON public.direct_messages(receiver_id) WHERE read_at IS NULL;

-- 3) Admin: send points
CREATE OR REPLACE FUNCTION public.admin_send_points(_target uuid, _amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _amount IS NULL OR _amount = 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  UPDATE public.profiles SET points = GREATEST(0, points + _amount) WHERE id = _target;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
END $$;

-- 4) Admin: broadcast announcement to all DMs + every room
CREATE OR REPLACE FUNCTION public.admin_broadcast(_text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _admin uuid := auth.uid();
  _content text;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _text IS NULL OR length(btrim(_text)) = 0 THEN RAISE EXCEPTION 'Empty text'; END IF;
  _content := '📢 ' || _text;

  -- Insert into every room as a regular text message from the admin.
  -- Admin must temporarily be a member-readable sender; we bypass via SECURITY DEFINER.
  INSERT INTO public.room_messages(room_id, user_id, content, message_type)
  SELECT r.id, _admin, _content, 'text'::public.message_type FROM public.rooms r;

  -- Insert a DM to every user (except admin themselves)
  INSERT INTO public.direct_messages(sender_id, receiver_id, content, message_type)
  SELECT _admin, p.id, _content, 'text'::public.message_type
  FROM public.profiles p WHERE p.id <> _admin;
END $$;

-- 5) Helper: mark DMs from a peer as read
CREATE OR REPLACE FUNCTION public.dm_mark_read(_peer uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.direct_messages
    SET read_at = now()
    WHERE receiver_id = auth.uid() AND sender_id = _peer AND read_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_points(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broadcast(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dm_mark_read(uuid) TO authenticated;
