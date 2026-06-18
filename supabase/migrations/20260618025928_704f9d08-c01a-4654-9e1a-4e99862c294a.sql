-- ============ ROOM VOICE BROADCAST SYSTEM ============

-- 1) SPEAKERS: who is currently on the audio stage
CREATE TABLE public.room_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_muted boolean NOT NULL DEFAULT false,
  is_speaking boolean NOT NULL DEFAULT false,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
CREATE INDEX idx_room_speakers_room ON public.room_speakers(room_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_speakers TO authenticated;
GRANT ALL ON public.room_speakers TO service_role;
ALTER TABLE public.room_speakers ENABLE ROW LEVEL SECURITY;

-- 2) SPEAKER INVITES: mods invite members to come up
CREATE TABLE public.room_speaker_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
CREATE INDEX idx_room_speaker_invites_room ON public.room_speaker_invites(room_id);
GRANT SELECT, INSERT, DELETE ON public.room_speaker_invites TO authenticated;
GRANT ALL ON public.room_speaker_invites TO service_role;
ALTER TABLE public.room_speaker_invites ENABLE ROW LEVEL SECURITY;

-- 3) RAISED HANDS: members request to speak
CREATE TABLE public.room_raised_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
CREATE INDEX idx_room_raised_hands_room ON public.room_raised_hands(room_id);
GRANT SELECT, INSERT, DELETE ON public.room_raised_hands TO authenticated;
GRANT ALL ON public.room_raised_hands TO service_role;
ALTER TABLE public.room_raised_hands ENABLE ROW LEVEL SECURITY;

-- 4) WebRTC SIGNALING for room voice (mesh)
CREATE TABLE public.room_voice_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type text NOT NULL CHECK (signal_type IN ('offer','answer','ice','leave')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_room_voice_signals_to ON public.room_voice_signals(to_user, room_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.room_voice_signals TO authenticated;
GRANT ALL ON public.room_voice_signals TO service_role;
ALTER TABLE public.room_voice_signals ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.is_room_moderator(_room uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = _room AND user_id = _user
      AND rank IN ('owner','admin','moderator')
  ) OR EXISTS (
    SELECT 1 FROM public.rooms WHERE id = _room AND owner_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_member(_room uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members WHERE room_id = _room AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.has_speaker_invite(_room uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_speaker_invites WHERE room_id = _room AND user_id = _user
  );
$$;

-- ============ RLS POLICIES ============

-- room_speakers: any room member can see who's on stage
CREATE POLICY "Members can view speakers" ON public.room_speakers
  FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

-- Speakers: self can join if (mod) or (has invite); mods can add anyone
CREATE POLICY "Mods or invited users can become speakers" ON public.room_speakers
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND (
      public.is_room_moderator(room_id, auth.uid())
      OR public.has_speaker_invite(room_id, auth.uid())
    )
  );

-- Speakers can update their own mute state; mods can update anyone's
CREATE POLICY "Self or mods can update speaker state" ON public.room_speakers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_moderator(room_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_room_moderator(room_id, auth.uid()));

-- Speakers can leave themselves; mods can remove anyone
CREATE POLICY "Self or mods can remove speakers" ON public.room_speakers
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_moderator(room_id, auth.uid()));

-- room_speaker_invites: invitee and mods can view
CREATE POLICY "Invitee or mods can view invites" ON public.room_speaker_invites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_room_moderator(room_id, auth.uid()));

CREATE POLICY "Mods can send invites" ON public.room_speaker_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND public.is_room_moderator(room_id, auth.uid())
    AND public.is_room_member(room_id, user_id)
  );

CREATE POLICY "Invitee or mods can delete invites" ON public.room_speaker_invites
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_moderator(room_id, auth.uid()));

-- room_raised_hands: mods can see all; users see their own
CREATE POLICY "Self or mods can view raised hands" ON public.room_raised_hands
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_room_moderator(room_id, auth.uid()));

CREATE POLICY "Members can raise hand" ON public.room_raised_hands
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_room_member(room_id, auth.uid())
  );

CREATE POLICY "Self or mods can lower hand" ON public.room_raised_hands
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_moderator(room_id, auth.uid()));

-- room_voice_signals: only the recipient can read; only speakers can send
CREATE POLICY "Recipient can read signals" ON public.room_voice_signals
  FOR SELECT TO authenticated
  USING (to_user = auth.uid());

CREATE POLICY "Speakers can send signals" ON public.room_voice_signals
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid()
    AND public.is_room_member(room_id, auth.uid())
  );

CREATE POLICY "Recipient or sender can delete signals" ON public.room_voice_signals
  FOR DELETE TO authenticated
  USING (to_user = auth.uid() OR from_user = auth.uid());

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_speakers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_speaker_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_raised_hands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_voice_signals;