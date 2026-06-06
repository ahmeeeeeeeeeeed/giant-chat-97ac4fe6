
-- 1) broadcasts table
CREATE TABLE IF NOT EXISTS public.music_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  track jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.music_broadcasts TO authenticated;
GRANT ALL ON public.music_broadcasts TO service_role;
ALTER TABLE public.music_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "broadcasts readable by authenticated" ON public.music_broadcasts
  FOR SELECT TO authenticated USING (true);

-- 2) reactions table
CREATE TABLE IF NOT EXISTS public.music_broadcast_reactions (
  broadcast_id uuid NOT NULL REFERENCES public.music_broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_broadcast_reactions TO authenticated;
GRANT ALL ON public.music_broadcast_reactions TO service_role;
ALTER TABLE public.music_broadcast_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions readable" ON public.music_broadcast_reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own reactions" ON public.music_broadcast_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own reactions" ON public.music_broadcast_reactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own reactions" ON public.music_broadcast_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3) music_play: replace current, clear queue, start paused
CREATE OR REPLACE FUNCTION public.music_play(_room uuid, _track jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_room_member(_room, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  INSERT INTO public.room_music(room_id) VALUES (_room) ON CONFLICT (room_id) DO NOTHING;
  UPDATE public.room_music
    SET current = _track,
        queue = '[]'::jsonb,
        started_at = now(),
        paused = true,
        paused_pos_ms = 0,
        updated_at = now()
    WHERE room_id = _room;
  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
    VALUES (_room, NULL,
      '🎵 جاهزة للتشغيل: ' || (_track->>'title') || ' — ' || (_track->>'artist')
        || COALESCE(' (طلبها ' || (_track->>'requester_name') || ')', ''),
      'system', jsonb_build_object('kind','music_now','track',_track));
END $function$;

-- 4) publish a song to ALL rooms (as a broadcast card)
CREATE OR REPLACE FUNCTION public.music_broadcast_publish(_track jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _bid uuid; _uname text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT username INTO _uname FROM public.profiles WHERE id = _uid;
  INSERT INTO public.music_broadcasts(requester_id, requester_name, track)
    VALUES (_uid, COALESCE(_uname,'مستخدم'), _track)
    RETURNING id INTO _bid;
  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
    SELECT r.id, NULL,
      '📣 ' || COALESCE(_uname,'مستخدم') || ' نشر أغنية: ' || (_track->>'title'),
      'system',
      jsonb_build_object('kind','music_broadcast','broadcast_id',_bid,'track',_track,'requester_id',_uid,'requester_name',_uname)
    FROM public.rooms r;
  RETURN _bid;
END $function$;

-- 5) react to a broadcast (idempotent, notifies publisher via DM)
CREATE OR REPLACE FUNCTION public.music_broadcast_react(_bid uuid, _emoji text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _req uuid; _track jsonb; _uname text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT requester_id, track INTO _req, _track FROM public.music_broadcasts WHERE id = _bid;
  IF _req IS NULL THEN RAISE EXCEPTION 'broadcast_not_found'; END IF;
  INSERT INTO public.music_broadcast_reactions(broadcast_id, user_id, emoji)
    VALUES (_bid, _uid, _emoji)
    ON CONFLICT (broadcast_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = now();
  IF _req <> _uid THEN
    SELECT username INTO _uname FROM public.profiles WHERE id = _uid;
    -- bypass dm lock/block triggers for system notifications
    PERFORM set_config('session_replication_role', 'replica', true);
    INSERT INTO public.direct_messages(sender_id, receiver_id, content, message_type)
      VALUES (_uid, _req,
        _emoji || ' تفاعل ' || COALESCE(_uname,'مستخدم') || ' مع أغنيتك «' || (_track->>'title') || '»',
        'text');
    PERFORM set_config('session_replication_role', 'origin', true);
  END IF;
END $function$;
