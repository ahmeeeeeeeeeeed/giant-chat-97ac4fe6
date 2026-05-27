
-- ============ FRIENDSHIPS ============
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "users create own requests" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "users update own friendships" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "users delete own friendships" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);

-- ============ ROOM BANS ============
CREATE TABLE public.room_bans (
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_bans TO authenticated;
GRANT ALL ON public.room_bans TO service_role;
ALTER TABLE public.room_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read bans" ON public.room_bans FOR SELECT TO authenticated
  USING (is_room_member(room_id, auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "owners/admins manage bans" ON public.room_bans FOR INSERT TO authenticated
  WITH CHECK (room_rank_of(room_id, auth.uid()) IN ('owner','admin') AND auth.uid() = banned_by);
CREATE POLICY "owners/admins remove bans" ON public.room_bans FOR DELETE TO authenticated
  USING (room_rank_of(room_id, auth.uid()) IN ('owner','admin'));

-- Block banned users from joining
CREATE OR REPLACE FUNCTION public.block_banned_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.room_bans WHERE room_id = NEW.room_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'User is banned from this room';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_banned_join
BEFORE INSERT ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.block_banned_join();

-- ============ ROOM LOGS ============
CREATE TYPE room_log_event AS ENUM ('join','leave','kick','ban','unban','promote','demote','transfer','mute','unmute');

CREATE TABLE public.room_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  actor_id uuid,
  target_id uuid,
  event room_log_event NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.room_logs TO authenticated;
GRANT ALL ON public.room_logs TO service_role;
ALTER TABLE public.room_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read logs" ON public.room_logs FOR SELECT TO authenticated
  USING (is_room_member(room_id, auth.uid()));
CREATE POLICY "members write logs" ON public.room_logs FOR INSERT TO authenticated
  WITH CHECK (is_room_member(room_id, auth.uid()));

CREATE INDEX idx_room_logs_room ON public.room_logs(room_id, created_at DESC);

-- Log join/leave automatically
CREATE OR REPLACE FUNCTION public.log_member_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event)
  VALUES (NEW.room_id, NEW.user_id, NEW.user_id, 'join');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_log_member_join AFTER INSERT ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.log_member_join();

-- ============ OWNERSHIP TRANSFER FUNCTION ============
CREATE OR REPLACE FUNCTION public.transfer_room_ownership(_room uuid, _new_owner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _current_owner uuid;
BEGIN
  SELECT owner_id INTO _current_owner FROM public.rooms WHERE id = _room;
  IF _current_owner IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF _current_owner <> auth.uid() THEN RAISE EXCEPTION 'Only owner can transfer ownership'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room AND user_id = _new_owner) THEN
    RAISE EXCEPTION 'New owner must be a member';
  END IF;
  UPDATE public.rooms SET owner_id = _new_owner WHERE id = _room;
  UPDATE public.room_members SET rank = 'admin' WHERE room_id = _room AND user_id = _current_owner;
  UPDATE public.room_members SET rank = 'owner' WHERE room_id = _room AND user_id = _new_owner;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event)
  VALUES (_room, _current_owner, _new_owner, 'transfer');
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_room_ownership(uuid, uuid) TO authenticated;

-- ============ KICK FUNCTION ============
CREATE OR REPLACE FUNCTION public.kick_room_member(_room uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF room_rank_of(_room, auth.uid()) NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF room_rank_of(_room, _user) = 'owner' THEN
    RAISE EXCEPTION 'Cannot kick owner';
  END IF;
  DELETE FROM public.room_members WHERE room_id = _room AND user_id = _user;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event)
  VALUES (_room, auth.uid(), _user, 'kick');
END;
$$;

GRANT EXECUTE ON FUNCTION public.kick_room_member(uuid, uuid) TO authenticated;

-- ============ BAN FUNCTION ============
CREATE OR REPLACE FUNCTION public.ban_room_member(_room uuid, _user uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF room_rank_of(_room, auth.uid()) NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF room_rank_of(_room, _user) = 'owner' THEN
    RAISE EXCEPTION 'Cannot ban owner';
  END IF;
  DELETE FROM public.room_members WHERE room_id = _room AND user_id = _user;
  INSERT INTO public.room_bans(room_id, user_id, banned_by, reason)
  VALUES (_room, _user, auth.uid(), _reason)
  ON CONFLICT (room_id, user_id) DO UPDATE SET banned_by = auth.uid(), reason = _reason;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event, meta)
  VALUES (_room, auth.uid(), _user, 'ban', jsonb_build_object('reason', _reason));
END;
$$;

GRANT EXECUTE ON FUNCTION public.ban_room_member(uuid, uuid, text) TO authenticated;

-- ============ PROMOTE / DEMOTE ============
CREATE OR REPLACE FUNCTION public.set_member_rank(_room uuid, _user uuid, _new_rank room_rank)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT owner_id FROM public.rooms WHERE id = _room) <> auth.uid() THEN
    RAISE EXCEPTION 'Only owner can change ranks';
  END IF;
  IF _new_rank = 'owner' THEN
    RAISE EXCEPTION 'Use transfer_room_ownership to change owner';
  END IF;
  UPDATE public.room_members SET rank = _new_rank WHERE room_id = _room AND user_id = _user;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event, meta)
  VALUES (_room, auth.uid(), _user,
    CASE WHEN _new_rank = 'admin' THEN 'promote'::room_log_event ELSE 'demote'::room_log_event END,
    jsonb_build_object('rank', _new_rank));
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_member_rank(uuid, uuid, room_rank) TO authenticated;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_bans;
