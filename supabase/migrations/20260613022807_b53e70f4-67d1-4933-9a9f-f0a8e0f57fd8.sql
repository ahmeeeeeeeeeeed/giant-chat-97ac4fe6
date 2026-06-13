
-- إضافة أعمدة لإعدادات الغرفة (نوع، كلمة مرور، حد أقصى للأعضاء، نشطة)
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS max_members integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- التحقق من النوع
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='rooms_type_chk') THEN
    ALTER TABLE public.rooms ADD CONSTRAINT rooms_type_chk CHECK (type IN ('public','private'));
  END IF;
END $$;

-- دالة الانضمام مع كلمة مرور (تتحقق من البان والحد الأقصى والباسورد)
CREATE OR REPLACE FUNCTION public.room_join(_room uuid, _password text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _room rooms%ROWTYPE; _count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO _room FROM public.rooms WHERE id=_room;
  IF _room.id IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF _room.is_active = false THEN RAISE EXCEPTION 'room_inactive'; END IF;
  IF EXISTS (SELECT 1 FROM public.room_bans WHERE room_id=_room.id AND user_id=_uid) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  IF EXISTS (SELECT 1 FROM public.room_members WHERE room_id=_room.id AND user_id=_uid) THEN
    RETURN;
  END IF;
  IF _room.type='private' THEN
    IF _password IS NULL OR _password = '' OR _room.password_hash IS NULL OR _room.password_hash <> _password THEN
      RAISE EXCEPTION 'wrong_password';
    END IF;
  END IF;
  SELECT count(*) INTO _count FROM public.room_members WHERE room_id=_room.id;
  IF _count >= _room.max_members THEN RAISE EXCEPTION 'room_full'; END IF;
  INSERT INTO public.room_members(room_id, user_id, rank) VALUES (_room.id, _uid, 'member');
END $$;

GRANT EXECUTE ON FUNCTION public.room_join(uuid, text) TO authenticated;

-- إلغاء حظر
CREATE OR REPLACE FUNCTION public.unban_room_member(_room uuid, _user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF room_rank_of(_room, auth.uid()) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.room_bans WHERE room_id=_room AND user_id=_user;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event)
    VALUES (_room, auth.uid(), _user, 'unban');
END $$;

GRANT EXECUTE ON FUNCTION public.unban_room_member(uuid, uuid) TO authenticated;
