
-- 1) Extend message_type enum
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'system';

-- 2) Allow null user_id (for system/bot messages) + optional meta
ALTER TABLE public.room_messages ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.room_messages ADD COLUMN IF NOT EXISTS meta jsonb;

-- 3) Extend room_log_event enum if needed (leave + music + bot already? add safely)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid='public.room_log_event'::regtype AND enumlabel='leave') THEN
    ALTER TYPE public.room_log_event ADD VALUE 'leave';
  END IF;
END $$;

-- 4) Log voluntary leave (skip if SET app.skip_leave_log = 'true' was set by kick/ban)
CREATE OR REPLACE FUNCTION public.log_member_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF coalesce(current_setting('app.skip_leave_log', true), '') = 'true' THEN
    RETURN OLD;
  END IF;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event)
  VALUES (OLD.room_id, OLD.user_id, OLD.user_id, 'leave');
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_log_member_leave ON public.room_members;
CREATE TRIGGER trg_log_member_leave
AFTER DELETE ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.log_member_leave();

-- Update kick/ban to suppress duplicate leave log
CREATE OR REPLACE FUNCTION public.kick_room_member(_room uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF room_rank_of(_room, auth.uid()) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF room_rank_of(_room, _user) = 'owner' THEN RAISE EXCEPTION 'Cannot kick owner'; END IF;
  PERFORM set_config('app.skip_leave_log','true',true);
  DELETE FROM public.room_members WHERE room_id=_room AND user_id=_user;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event)
  VALUES (_room, auth.uid(), _user, 'kick');
END $$;

CREATE OR REPLACE FUNCTION public.ban_room_member(_room uuid, _user uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF room_rank_of(_room, auth.uid()) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF room_rank_of(_room, _user) = 'owner' THEN RAISE EXCEPTION 'Cannot ban owner'; END IF;
  PERFORM set_config('app.skip_leave_log','true',true);
  DELETE FROM public.room_members WHERE room_id=_room AND user_id=_user;
  INSERT INTO public.room_bans(room_id, user_id, banned_by, reason)
  VALUES (_room, _user, auth.uid(), _reason)
  ON CONFLICT (room_id, user_id) DO UPDATE SET banned_by=auth.uid(), reason=_reason;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event, meta)
  VALUES (_room, auth.uid(), _user, 'ban', jsonb_build_object('reason',_reason));
END $$;

-- 5) Convert room_logs entries to system messages
CREATE OR REPLACE FUNCTION public.log_to_system_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor_name text; target_name text; msg text;
BEGIN
  SELECT username INTO actor_name FROM profiles WHERE id=NEW.actor_id;
  SELECT username INTO target_name FROM profiles WHERE id=NEW.target_id;
  msg := CASE NEW.event::text
    WHEN 'join'     THEN '👋 دخل ' || COALESCE(target_name,'مستخدم')
    WHEN 'leave'    THEN '🚪 غادر ' || COALESCE(target_name,'مستخدم')
    WHEN 'kick'     THEN '⚠️ تم طرد ' || COALESCE(target_name,'') || ' بواسطة ' || COALESCE(actor_name,'')
    WHEN 'ban'      THEN '🚫 تم حظر ' || COALESCE(target_name,'') || ' بواسطة ' || COALESCE(actor_name,'')
    WHEN 'promote'  THEN '⬆️ تمت ترقية ' || COALESCE(target_name,'') || ' إلى ' || COALESCE(NEW.meta->>'rank','إداري')
    WHEN 'demote'   THEN '⬇️ تم تخفيض ' || COALESCE(target_name,'') || ' إلى عضو'
    WHEN 'transfer' THEN '👑 تم نقل ملكية الغرفة إلى ' || COALESCE(target_name,'')
    ELSE NEW.event::text
  END;
  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
  VALUES (NEW.room_id, NULL, msg, 'system'::message_type,
          jsonb_build_object('kind','event','event',NEW.event::text,'actor',actor_name,'target',target_name));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_to_system_message ON public.room_logs;
CREATE TRIGGER trg_log_to_system_message
AFTER INSERT ON public.room_logs
FOR EACH ROW EXECUTE FUNCTION public.log_to_system_message();

-- 6) Room music state
CREATE TABLE IF NOT EXISTS public.room_music (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  current jsonb,            -- { title, artist, artwork, preview_url, duration_ms, requester_name, requester_id }
  queue jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  paused boolean NOT NULL DEFAULT false,
  paused_pos_ms integer NOT NULL DEFAULT 0,
  volume integer NOT NULL DEFAULT 70,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.room_music TO authenticated;
GRANT ALL ON public.room_music TO service_role;
ALTER TABLE public.room_music ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read room music" ON public.room_music
  FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_music;

-- 7) Bot/system message helper (callable by members of the room)
CREATE OR REPLACE FUNCTION public.room_bot_say(_room uuid, _text text, _kind text DEFAULT 'bot', _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_room_member(_room, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
  VALUES (_room, NULL, _text, 'system'::message_type, jsonb_build_object('kind',_kind) || COALESCE(_meta,'{}'::jsonb));
END $$;

-- 8) Music control RPCs
CREATE OR REPLACE FUNCTION public.music_play(_room uuid, _track jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _cur jsonb; _q jsonb;
BEGIN
  IF NOT public.is_room_member(_room, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  INSERT INTO public.room_music(room_id) VALUES (_room) ON CONFLICT (room_id) DO NOTHING;
  SELECT current, queue INTO _cur, _q FROM public.room_music WHERE room_id=_room FOR UPDATE;
  IF _cur IS NULL THEN
    UPDATE public.room_music SET current=_track, started_at=now(), paused=false, paused_pos_ms=0, updated_at=now()
      WHERE room_id=_room;
    INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
      VALUES (_room, NULL, '🎵 يشغل الآن: ' || (_track->>'title') || ' — ' || (_track->>'artist'),
              'system', jsonb_build_object('kind','music_now','track',_track));
  ELSE
    UPDATE public.room_music SET queue = queue || _track, updated_at=now() WHERE room_id=_room;
    INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
      VALUES (_room, NULL, '➕ أضيفت إلى قائمة الانتظار: ' || (_track->>'title'),
              'system', jsonb_build_object('kind','music_queued','track',_track));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.music_pause(_room uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _st timestamptz; _pp int;
BEGIN
  IF NOT public.is_room_member(_room, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  SELECT started_at, paused_pos_ms INTO _st, _pp FROM public.room_music WHERE room_id=_room;
  IF _st IS NULL THEN RETURN; END IF;
  UPDATE public.room_music SET paused=true,
    paused_pos_ms = _pp + EXTRACT(EPOCH FROM (now()-_st))*1000,
    updated_at=now()
    WHERE room_id=_room AND paused=false;
END $$;

CREATE OR REPLACE FUNCTION public.music_resume(_room uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_room_member(_room, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  UPDATE public.room_music SET paused=false, started_at=now(), updated_at=now()
    WHERE room_id=_room AND paused=true;
END $$;

CREATE OR REPLACE FUNCTION public.music_stop(_room uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_room_member(_room, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  UPDATE public.room_music SET current=NULL, queue='[]'::jsonb, started_at=NULL, paused=false, paused_pos_ms=0, updated_at=now()
    WHERE room_id=_room;
  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
    VALUES (_room, NULL, '⏹️ تم إيقاف الموسيقى', 'system', '{"kind":"music_stop"}');
END $$;

CREATE OR REPLACE FUNCTION public.music_skip(_room uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _q jsonb; _next jsonb;
BEGIN
  IF NOT public.is_room_member(_room, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  SELECT queue INTO _q FROM public.room_music WHERE room_id=_room FOR UPDATE;
  _next := _q->0;
  IF _next IS NULL THEN
    UPDATE public.room_music SET current=NULL, started_at=NULL, paused=false, paused_pos_ms=0, updated_at=now() WHERE room_id=_room;
    INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
      VALUES (_room, NULL, '⏭️ لا توجد أغانٍ أخرى', 'system', '{"kind":"music_skip"}');
  ELSE
    UPDATE public.room_music SET current=_next, queue = queue - 0,
      started_at=now(), paused=false, paused_pos_ms=0, updated_at=now()
      WHERE room_id=_room;
    INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
      VALUES (_room, NULL, '⏭️ يشغل الآن: ' || (_next->>'title') || ' — ' || (_next->>'artist'),
              'system', jsonb_build_object('kind','music_now','track',_next));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.music_set_volume(_room uuid, _vol int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_room_member(_room, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  IF _vol < 0 OR _vol > 100 THEN RAISE EXCEPTION 'volume 0..100'; END IF;
  UPDATE public.room_music SET volume=_vol, updated_at=now() WHERE room_id=_room;
END $$;

CREATE OR REPLACE FUNCTION public.music_advance_if_ended(_room uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _cur jsonb; _st timestamptz; _dur int;
BEGIN
  IF NOT public.is_room_member(_room, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  SELECT current, started_at INTO _cur, _st FROM public.room_music WHERE room_id=_room;
  IF _cur IS NULL OR _st IS NULL THEN RETURN; END IF;
  _dur := COALESCE((_cur->>'duration_ms')::int, 30000);
  IF EXTRACT(EPOCH FROM (now()-_st))*1000 >= _dur THEN
    PERFORM public.music_skip(_room);
  END IF;
END $$;
