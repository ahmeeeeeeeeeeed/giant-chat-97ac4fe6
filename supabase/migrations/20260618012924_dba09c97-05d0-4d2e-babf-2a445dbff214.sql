
-- Invitations for private rooms
CREATE TABLE IF NOT EXISTS public.room_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.room_invites TO authenticated;
GRANT ALL ON public.room_invites TO service_role;

ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;

-- Helper: is user invited to room
CREATE OR REPLACE FUNCTION public.is_room_invited(_room uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_invites WHERE room_id = _room AND user_id = _user);
$$;

-- Helper: is user owner of room
CREATE OR REPLACE FUNCTION public.is_room_owner(_room uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rooms WHERE id = _room AND owner_id = _user);
$$;

CREATE POLICY "owner or invitee can view invites" ON public.room_invites
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_room_owner(room_id, auth.uid()));

CREATE POLICY "owner can invite" ON public.room_invites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = invited_by AND public.is_room_owner(room_id, auth.uid()));

CREATE POLICY "owner or invitee can revoke" ON public.room_invites
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_room_owner(room_id, auth.uid()));

-- Tighten rooms SELECT: hide private rooms from non-owner/non-invitee
DROP POLICY IF EXISTS "rooms readable by authenticated" ON public.rooms;
CREATE POLICY "rooms readable by allowed users" ON public.rooms
  FOR SELECT TO authenticated
  USING (
    type = 'public'
    OR owner_id = auth.uid()
    OR public.is_room_invited(id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
