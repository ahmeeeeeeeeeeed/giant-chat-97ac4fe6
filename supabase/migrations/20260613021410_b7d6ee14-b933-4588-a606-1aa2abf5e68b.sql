
CREATE OR REPLACE FUNCTION public.admin_broadcast(_text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := auth.uid();
  _content text;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _text IS NULL OR length(btrim(_text)) = 0 THEN RAISE EXCEPTION 'Empty text'; END IF;
  _content := '📢 إعلان من النظام: ' || _text;

  -- Post as a system message in every room (no user_id => shown as "النظام")
  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
  SELECT r.id, NULL, _content, 'system'::public.message_type,
         jsonb_build_object('kind','admin_broadcast')
  FROM public.rooms r;

  -- Bypass dm lock/block triggers so the announcement reaches everyone
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.direct_messages(sender_id, receiver_id, content, message_type)
  SELECT _admin, p.id, _content, 'text'::public.message_type
  FROM public.profiles p WHERE p.id <> _admin;
  PERFORM set_config('session_replication_role', 'origin', true);
END $function$;
