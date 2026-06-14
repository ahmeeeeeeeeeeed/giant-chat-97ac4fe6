CREATE OR REPLACE FUNCTION public.room_invite_username(_room uuid, _username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _target uuid;
  _rname text;
  _uname text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _username IS NULL OR length(btrim(_username)) = 0 THEN RAISE EXCEPTION 'empty_username'; END IF;
  SELECT id INTO _target FROM public.profiles WHERE lower(username) = lower(btrim(_username)) LIMIT 1;
  IF _target IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF _target = _uid THEN RAISE EXCEPTION 'cannot_invite_self'; END IF;
  SELECT name INTO _rname FROM public.rooms WHERE id = _room;
  IF _rname IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  SELECT username INTO _uname FROM public.profiles WHERE id = _uid;
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.direct_messages(sender_id, receiver_id, content, message_type)
    VALUES (_uid, _target,
      '🎉 دعاك ' || COALESCE(_uname,'مستخدم') || ' للانضمام إلى غرفة «' || _rname || '»',
      'text');
  PERFORM set_config('session_replication_role', 'origin', true);
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.room_invite_username(uuid, text) TO authenticated;