
-- 1. game_rounds: hide secret column from clients (server-side definer fns still read it)
REVOKE SELECT (secret) ON public.game_rounds FROM anon, authenticated;

-- 2. profiles: hide recovery_email columns from other users
REVOKE SELECT (recovery_email, recovery_email_verified_at) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_recovery_status()
RETURNS TABLE(recovery_email text, recovery_email_verified_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT recovery_email, recovery_email_verified_at
  FROM public.profiles WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_recovery_status() TO authenticated;

-- 3. room_members: drop wildcard policy
DROP POLICY IF EXISTS enable_all_for_authenticated ON public.room_members;

-- 4. user_badges: remove user self-insert
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can update their own badges" ON public.user_badges;
CREATE POLICY "Admins manage badges" ON public.user_badges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5. rooms: hash passwords with pgcrypto + hide hash column
CREATE EXTENSION IF NOT EXISTS pgcrypto;
REVOKE SELECT (password_hash) ON public.rooms FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rooms_hash_password()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.password_hash IS NOT NULL AND length(NEW.password_hash) > 0
     AND NEW.password_hash NOT LIKE '$2%$%' THEN
    NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rooms_hash_password_trg ON public.rooms;
CREATE TRIGGER rooms_hash_password_trg
  BEFORE INSERT OR UPDATE OF password_hash ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.rooms_hash_password();

-- Hash any existing plaintext passwords
UPDATE public.rooms
  SET password_hash = crypt(password_hash, gen_salt('bf'))
  WHERE password_hash IS NOT NULL
    AND length(password_hash) > 0
    AND password_hash NOT LIKE '$2%$%';

-- Update room_join to use crypt() compare
CREATE OR REPLACE FUNCTION public.room_join(_room uuid, _password text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _room rooms%ROWTYPE; _count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO _room FROM public.rooms WHERE id=_room;
  IF _room.id IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF _room.is_active = false THEN RAISE EXCEPTION 'room_inactive'; END IF;
  IF EXISTS (SELECT 1 FROM public.room_bans WHERE room_id=_room.id AND user_id=_uid) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  IF EXISTS (SELECT 1 FROM public.room_members WHERE room_id=_room.id AND user_id=_uid) THEN
    RETURN;
  END IF;
  IF _room.type='private' THEN
    IF _password IS NULL OR _password = '' OR _room.password_hash IS NULL
       OR _room.password_hash <> crypt(_password, _room.password_hash) THEN
      RAISE EXCEPTION 'wrong_password';
    END IF;
  END IF;
  SELECT count(*) INTO _count FROM public.room_members WHERE room_id=_room.id;
  IF _count >= _room.max_members THEN RAISE EXCEPTION 'room_full'; END IF;
  INSERT INTO public.room_members(room_id, user_id, rank) VALUES (_room.id, _uid, 'member');
END $function$;

-- 6. realtime: deny unknown topics
DROP POLICY IF EXISTS "dm realtime read" ON realtime.messages;
CREATE POLICY "dm realtime read" ON realtime.messages
FOR SELECT TO authenticated
USING (
  CASE
    WHEN (realtime.topic() LIKE 'dm-msg:%' OR realtime.topic() LIKE 'dm-presence:%' OR realtime.topic() LIKE 'dm-unread:%')
      THEN POSITION((auth.uid())::text IN realtime.topic()) > 0
    WHEN (realtime.topic() LIKE 'music:%' OR realtime.topic() LIKE 'room:%')
      THEN EXISTS (SELECT 1 FROM public.room_members rm
                   WHERE rm.user_id = auth.uid()
                     AND (rm.room_id)::text = split_part(realtime.topic(), ':', 2))
    ELSE false
  END
);

-- 7. friendships: only addressee can accept/update
DROP POLICY IF EXISTS "users update own friendships" ON public.friendships;
CREATE POLICY "addressee updates friendships" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

-- 8. fix mutable search_path on remaining functions
ALTER FUNCTION public.community_posts_touch() SET search_path = public;
ALTER FUNCTION public.add_member_to_room(uuid) SET search_path = public;
