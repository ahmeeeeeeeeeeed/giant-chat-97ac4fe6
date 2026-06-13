CREATE OR REPLACE FUNCTION public.rooms_hash_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.password_hash IS NOT NULL AND length(NEW.password_hash) > 0
     AND NEW.password_hash NOT LIKE '$2%$%' THEN
    NEW.password_hash := extensions.crypt(NEW.password_hash, extensions.gen_salt('bf'));
  END IF;
  RETURN NEW;
END $function$;

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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO _r FROM public.rooms WHERE id = _room;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF _r.is_active = false THEN RAISE EXCEPTION 'room_inactive'; END IF;
  IF EXISTS (SELECT 1 FROM public.room_bans WHERE room_id = _r.id AND user_id = _uid) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  IF EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _r.id AND user_id = _uid) THEN
    RETURN;
  END IF;
  IF _r.type = 'private' THEN
    IF _password IS NULL OR _password = '' OR _r.password_hash IS NULL
       OR _r.password_hash <> extensions.crypt(_password, _r.password_hash) THEN
      RAISE EXCEPTION 'wrong_password';
    END IF;
  END IF;
  SELECT count(*) INTO _count FROM public.room_members WHERE room_id = _r.id;
  IF _count >= _r.max_members THEN RAISE EXCEPTION 'room_full'; END IF;
  INSERT INTO public.room_members(room_id, user_id, rank) VALUES (_r.id, _uid, 'member');
END $function$;