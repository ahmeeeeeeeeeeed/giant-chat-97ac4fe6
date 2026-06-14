
CREATE OR REPLACE FUNCTION public.music_seek(_room uuid, _pos_ms int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _cur jsonb; _dur int; _was_paused boolean;
BEGIN
  IF NOT public.is_room_member(_room, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  SELECT current, paused INTO _cur, _was_paused FROM public.room_music WHERE room_id=_room FOR UPDATE;
  IF _cur IS NULL THEN RETURN; END IF;
  _dur := COALESCE((_cur->>'duration_ms')::int, 30000);
  IF _pos_ms < 0 THEN _pos_ms := 0; END IF;
  IF _pos_ms > _dur - 250 THEN _pos_ms := GREATEST(_dur - 250, 0); END IF;
  UPDATE public.room_music
     SET paused_pos_ms = _pos_ms,
         started_at = CASE WHEN _was_paused THEN started_at ELSE now() END,
         updated_at = now()
   WHERE room_id = _room;
END $$;
GRANT EXECUTE ON FUNCTION public.music_seek(uuid, int) TO authenticated;
