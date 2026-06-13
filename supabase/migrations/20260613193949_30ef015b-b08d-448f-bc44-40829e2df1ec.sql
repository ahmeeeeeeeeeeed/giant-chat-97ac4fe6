
-- 1) Add 'moderator' to room_rank enum (if not present)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='room_rank' AND e.enumlabel='moderator') THEN
    ALTER TYPE public.room_rank ADD VALUE 'moderator' BEFORE 'member';
  END IF;
END $$;

-- 2) Fix room_join (variable shadowing of _room param)
CREATE OR REPLACE FUNCTION public.room_join(_room uuid, _password text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
       OR _r.password_hash <> crypt(_password, _r.password_hash) THEN
      RAISE EXCEPTION 'wrong_password';
    END IF;
  END IF;
  SELECT count(*) INTO _count FROM public.room_members WHERE room_id = _r.id;
  IF _count >= _r.max_members THEN RAISE EXCEPTION 'room_full'; END IF;
  INSERT INTO public.room_members(room_id, user_id, rank) VALUES (_r.id, _uid, 'member');
END $function$;

-- 3) Lock ownership transfer permanently
CREATE OR REPLACE FUNCTION public.transfer_room_ownership(_room uuid, _new_owner uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'ownership_locked';
END $function$;

-- 4) set_member_rank — admin can manage admin/moderator/member; owner is untouchable
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
  IF _actor_rank IS NULL OR _actor_rank NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT rank INTO _target_rank FROM public.room_members WHERE room_id=_room AND user_id=_user;
  IF _target_rank IS NULL THEN RAISE EXCEPTION 'target_not_member'; END IF;
  IF _target_rank = 'owner' THEN RAISE EXCEPTION 'owner_immutable'; END IF;
  UPDATE public.room_members SET rank=_new_rank WHERE room_id=_room AND user_id=_user;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event, meta)
  VALUES (_room, auth.uid(), _user,
    CASE WHEN _new_rank IN ('admin','moderator') THEN 'promote'::public.room_log_event ELSE 'demote'::public.room_log_event END,
    jsonb_build_object('rank', _new_rank));
END $function$;

-- 5) kick — admin/moderator can kick non-owner; moderator cannot kick admins
CREATE OR REPLACE FUNCTION public.kick_room_member(_room uuid, _user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _ar public.room_rank; _tr public.room_rank;
BEGIN
  SELECT rank INTO _ar FROM public.room_members WHERE room_id=_room AND user_id=auth.uid();
  SELECT rank INTO _tr FROM public.room_members WHERE room_id=_room AND user_id=_user;
  IF _ar IS NULL OR _ar NOT IN ('owner','admin','moderator') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _tr = 'owner' THEN RAISE EXCEPTION 'cannot_kick_owner'; END IF;
  IF _ar = 'moderator' AND _tr IN ('admin','moderator') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM set_config('app.skip_leave_log','true',true);
  DELETE FROM public.room_members WHERE room_id=_room AND user_id=_user;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event)
  VALUES (_room, auth.uid(), _user, 'kick');
END $function$;

-- 6) ban — same rules as kick
CREATE OR REPLACE FUNCTION public.ban_room_member(_room uuid, _user uuid, _reason text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _ar public.room_rank; _tr public.room_rank;
BEGIN
  SELECT rank INTO _ar FROM public.room_members WHERE room_id=_room AND user_id=auth.uid();
  SELECT rank INTO _tr FROM public.room_members WHERE room_id=_room AND user_id=_user;
  IF _ar IS NULL OR _ar NOT IN ('owner','admin','moderator') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _tr = 'owner' THEN RAISE EXCEPTION 'cannot_ban_owner'; END IF;
  IF _ar = 'moderator' AND _tr IN ('admin','moderator') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM set_config('app.skip_leave_log','true',true);
  DELETE FROM public.room_members WHERE room_id=_room AND user_id=_user;
  INSERT INTO public.room_bans(room_id, user_id, banned_by, reason)
  VALUES (_room, _user, auth.uid(), _reason)
  ON CONFLICT (room_id, user_id) DO UPDATE SET banned_by=auth.uid(), reason=_reason;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event, meta)
  VALUES (_room, auth.uid(), _user, 'ban', jsonb_build_object('reason',_reason));
END $function$;
