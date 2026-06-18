CREATE OR REPLACE FUNCTION public.room_join(_room uuid, _password text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _r public.rooms%ROWTYPE;
  _count int;
  _bypass boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO _r FROM public.rooms WHERE id = _room;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF _r.is_active = false THEN RAISE EXCEPTION 'room_inactive'; END IF;
  IF EXISTS (SELECT 1 FROM public.room_bans WHERE room_id = _r.id AND user_id = _uid) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  -- If already a member, refresh joined_at so previous-session messages
  -- are hidden after re-entering the room.
  IF EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _r.id AND user_id = _uid) THEN
    UPDATE public.room_members SET joined_at = now()
     WHERE room_id = _r.id AND user_id = _uid;
    RETURN;
  END IF;
  IF _r.type = 'private' THEN
    _bypass := (_r.owner_id = _uid)
            OR EXISTS (SELECT 1 FROM public.room_invites WHERE room_id = _r.id AND user_id = _uid)
            OR public.has_role(_uid, 'admin'::app_role);
    IF NOT _bypass THEN
      IF _r.password_hash IS NULL THEN
        RAISE EXCEPTION 'not_invited';
      END IF;
      IF _password IS NULL OR _password = ''
         OR _r.password_hash <> extensions.crypt(_password, _r.password_hash) THEN
        RAISE EXCEPTION 'wrong_password';
      END IF;
    END IF;
  END IF;
  SELECT count(*) INTO _count FROM public.room_members WHERE room_id = _r.id;
  IF _count >= _r.max_members THEN RAISE EXCEPTION 'room_full'; END IF;
  INSERT INTO public.room_members(room_id, user_id, rank, joined_at)
  VALUES (_r.id, _uid, CASE WHEN _r.owner_id = _uid THEN 'owner'::room_rank ELSE 'member'::room_rank END, now());
END $function$;