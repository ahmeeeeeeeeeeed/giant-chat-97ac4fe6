
CREATE OR REPLACE FUNCTION public.room_invite_friends(_room uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _uname text;
  _rname text;
  _rtype text;
  _count integer := 0;
  _msg text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT name, type INTO _rname, _rtype FROM public.rooms WHERE id = _room AND is_active = true;
  IF _rname IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  SELECT username INTO _uname FROM public.profiles WHERE id = _uid;

  _msg := '🎉 دعاك ' || COALESCE(_uname,'صديقك')
       || ' للانضمام إلى الغرفة «' || _rname || '»'
       || CASE WHEN _rtype = 'private' THEN ' (غرفة خاصة — اطلب كلمة السر منه)' ELSE '' END
       || E'\nاضغط للدخول: /app/rooms/' || _room::text;

  -- bypass dm lock/block triggers (friends-only message)
  PERFORM set_config('session_replication_role', 'replica', true);
  WITH friends AS (
    SELECT CASE WHEN requester_id = _uid THEN addressee_id ELSE requester_id END AS friend_id
    FROM public.friendships
    WHERE status = 'accepted'
      AND (requester_id = _uid OR addressee_id = _uid)
  ),
  inserted AS (
    INSERT INTO public.direct_messages(sender_id, receiver_id, content, message_type)
    SELECT _uid, friend_id, _msg, 'text'
    FROM friends
    WHERE friend_id <> _uid
    RETURNING 1
  )
  SELECT count(*) INTO _count FROM inserted;
  PERFORM set_config('session_replication_role', 'origin', true);

  RETURN _count;
END $$;

REVOKE ALL ON FUNCTION public.room_invite_friends(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_invite_friends(uuid) TO authenticated;
