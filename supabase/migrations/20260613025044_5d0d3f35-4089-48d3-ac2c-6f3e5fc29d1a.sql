
-- Share music track to a specific user via DM
CREATE OR REPLACE FUNCTION public.music_share_to_user(_peer uuid, _track jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _uname text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _peer IS NULL OR _peer = _uid THEN RAISE EXCEPTION 'invalid_peer'; END IF;
  SELECT username INTO _uname FROM public.profiles WHERE id = _uid;
  -- Bypass dm lock/block triggers? No — respect them (recipient may have blocked sender).
  INSERT INTO public.direct_messages(sender_id, receiver_id, content, message_type)
  VALUES (
    _uid, _peer,
    '🎵TRACK::' || _track::text || '::' || COALESCE(_uname, 'مستخدم'),
    'text'
  );
END $$;

-- Share a user post (text + optional image) into every room as a system card
CREATE OR REPLACE FUNCTION public.share_post_to_all_rooms(
  _text text,
  _image_url text DEFAULT NULL,
  _source_room uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _uname text; _src_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF (_text IS NULL OR length(btrim(_text)) = 0) AND (_image_url IS NULL OR length(btrim(_image_url)) = 0) THEN
    RAISE EXCEPTION 'empty_post';
  END IF;
  SELECT username INTO _uname FROM public.profiles WHERE id = _uid;
  IF _source_room IS NOT NULL THEN
    SELECT name INTO _src_name FROM public.rooms WHERE id = _source_room;
  END IF;
  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
  SELECT r.id, NULL,
    '📝 ' || COALESCE(_uname, 'مستخدم')
      || COALESCE(' من غرفة «' || _src_name || '»', '')
      || ': ' || COALESCE(_text, ''),
    'system',
    jsonb_build_object(
      'kind','user_share',
      'author_id', _uid,
      'author_name', COALESCE(_uname,'مستخدم'),
      'text', _text,
      'image_url', _image_url,
      'source_room_id', _source_room,
      'source_room_name', _src_name
    )
  FROM public.rooms r
  WHERE r.is_active = true;
END $$;
