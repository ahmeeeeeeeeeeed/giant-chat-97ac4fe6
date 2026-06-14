
CREATE OR REPLACE FUNCTION public.set_member_rank(_room uuid, _user uuid, _new_rank public.room_rank)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor_rank public.room_rank;
  _target_rank public.room_rank;
BEGIN
  IF _new_rank = 'owner' THEN RAISE EXCEPTION 'cannot_set_owner'; END IF;
  SELECT rank INTO _actor_rank FROM public.room_members WHERE room_id=_room AND user_id=auth.uid();
  IF _actor_rank IS NULL OR _actor_rank NOT IN ('owner','admin','moderator') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT rank INTO _target_rank FROM public.room_members WHERE room_id=_room AND user_id=_user;
  IF _target_rank IS NULL THEN RAISE EXCEPTION 'target_not_member'; END IF;
  IF _target_rank = 'owner' THEN RAISE EXCEPTION 'owner_immutable'; END IF;
  -- moderator may only grant the plain 'member' rank, and only to non-admin/non-moderator targets
  IF _actor_rank = 'moderator' THEN
    IF _new_rank <> 'member' THEN RAISE EXCEPTION 'moderator_can_only_grant_member'; END IF;
    IF _target_rank IN ('admin','moderator') THEN RAISE EXCEPTION 'moderator_cannot_demote_staff'; END IF;
  END IF;
  UPDATE public.room_members SET rank=_new_rank WHERE room_id=_room AND user_id=_user;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event, meta)
  VALUES (_room, auth.uid(), _user,
    CASE WHEN _new_rank IN ('admin','moderator') THEN 'promote'::public.room_log_event ELSE 'demote'::public.room_log_event END,
    jsonb_build_object('rank', _new_rank));
END $function$;
