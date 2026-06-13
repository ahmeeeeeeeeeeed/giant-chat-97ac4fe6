CREATE OR REPLACE FUNCTION public.music_broadcast_publish(_track jsonb, _source_room uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _bid uuid; _uname text; _src_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT username INTO _uname FROM public.profiles WHERE id = _uid;
  IF _source_room IS NOT NULL THEN
    SELECT name INTO _src_name FROM public.rooms WHERE id = _source_room;
  END IF;
  INSERT INTO public.music_broadcasts(requester_id, requester_name, track)
    VALUES (_uid, COALESCE(_uname,'مستخدم'), _track)
    RETURNING id INTO _bid;
  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
    SELECT r.id, NULL,
      '📣 ' || COALESCE(_uname,'مستخدم')
        || COALESCE(' من غرفة «' || _src_name || '»', '')
        || ' نشر أغنية: ' || (_track->>'title'),
      'system',
      jsonb_build_object(
        'kind','music_broadcast',
        'broadcast_id',_bid,
        'track',_track,
        'requester_id',_uid,
        'requester_name',_uname,
        'source_room_id',_source_room,
        'source_room_name',_src_name
      )
    FROM public.rooms r;
  RETURN _bid;
END $function$;