-- Enable pg_net for HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============ giant bot id constant via function ============
CREATE OR REPLACE FUNCTION public.giant_bot_id()
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT '9224081f-43d0-4761-b2e2-bfdd4e8e714c'::uuid
$$;

-- ============ Update bot profile ============
UPDATE public.profiles
SET username = 'giant Administrator',
    bio = '🤖 المساعد الذكي الرسمي للتطبيق — يجيب على أسئلتكم بالعربية، يترجم، يحسب، ويدير الغرف. متاح 24/7.',
    avatar_url = COALESCE(avatar_url, 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=giant&backgroundColor=4f46e5')
WHERE id = public.giant_bot_id();

-- ============ bot_config (webhook url + secret) ============
CREATE TABLE IF NOT EXISTS public.bot_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bot_config TO service_role;
ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role can access (RLS blocks anon/auth)

INSERT INTO public.bot_config(key, value) VALUES
  ('webhook_url', 'https://giant-chat.lovable.app/api/public/giant-bot-webhook'),
  ('webhook_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- ============ bot_permissions (MAS) ============
CREATE TABLE IF NOT EXISTS public.bot_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
GRANT SELECT ON public.bot_permissions TO authenticated;
GRANT ALL ON public.bot_permissions TO service_role;
ALTER TABLE public.bot_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view MAS list of their rooms"
  ON public.bot_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = bot_permissions.room_id AND rm.user_id = auth.uid()));

-- ============ bot_logs ============
CREATE TABLE IF NOT EXISTS public.bot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  args jsonb,
  success boolean NOT NULL DEFAULT true,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bot_logs TO authenticated;
GRANT ALL ON public.bot_logs TO service_role;
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room owners/admins view logs of their rooms"
  ON public.bot_logs FOR SELECT TO authenticated
  USING (
    actor_id = auth.uid() OR target_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = bot_logs.room_id AND r.owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_bot_logs_room ON public.bot_logs(room_id, created_at DESC);

-- ============ helper: has_bot_admin ============
CREATE OR REPLACE FUNCTION public.has_bot_admin(_user uuid, _room uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rooms WHERE id=_room AND owner_id=_user)
      OR EXISTS (SELECT 1 FROM public.bot_permissions WHERE room_id=_room AND user_id=_user);
$$;

-- ============ Make giant bot rank=admin in every room ============
INSERT INTO public.room_members(room_id, user_id, rank)
SELECT r.id, public.giant_bot_id(), 'admin'::room_rank
FROM public.rooms r
ON CONFLICT (room_id, user_id) DO UPDATE SET rank='admin'::room_rank;

-- ============ Update auto-add-bots trigger to give giant bot admin rank ============
CREATE OR REPLACE FUNCTION public.tg_add_bots_to_new_room()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.room_members(room_id, user_id, rank)
  SELECT NEW.id, p.id,
         CASE WHEN p.id = public.giant_bot_id() THEN 'admin'::room_rank ELSE 'member'::room_rank END
  FROM public.profiles p
  WHERE p.is_bot = true
  ON CONFLICT (room_id, user_id) DO NOTHING;
  RETURN NEW;
END $$;

-- ============ Disable legacy auto-reply triggers for giant bot ============
-- (legacy triggers still handle other bots; giant bot replies now via webhook)

-- ============ Webhook caller ============
CREATE OR REPLACE FUNCTION public.tg_giant_bot_room_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE
  _url text;
  _secret text;
  _bot uuid := public.giant_bot_id();
  _content text := COALESCE(NEW.content, '');
  _low text := lower(_content);
  _is_member boolean;
  _trigger_words text := 'بوت|giant|@admin|@بوت|احسب|اشرح|ترجم|لخص|ابحث|هات|احظر|اطرد|اكتم|افتح|ارفع|انزل|انزّل|أنزل|امنح|اسحب|فك|رفع|نزل';
BEGIN
  -- Skip system/bot messages
  IF NEW.user_id IS NULL OR NEW.user_id = _bot THEN RETURN NEW; END IF;
  IF NEW.message_type <> 'text' THEN RETURN NEW; END IF;
  IF length(btrim(_content)) = 0 THEN RETURN NEW; END IF;

  -- Bot must be in the room (it is auto-joined to all rooms)
  SELECT EXISTS(SELECT 1 FROM public.room_members WHERE room_id=NEW.room_id AND user_id=_bot) INTO _is_member;
  IF NOT _is_member THEN RETURN NEW; END IF;

  -- Filter: only if message looks like it addresses bot or is a command
  IF _low !~ ('(' || _trigger_words || ')') THEN RETURN NEW; END IF;

  SELECT value INTO _url FROM public.bot_config WHERE key='webhook_url';
  SELECT value INTO _secret FROM public.bot_config WHERE key='webhook_secret';
  IF _url IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-bot-secret', _secret
    ),
    body := jsonb_build_object(
      'kind','room_message',
      'message_id', NEW.id,
      'room_id', NEW.room_id,
      'sender_id', NEW.user_id,
      'content', NEW.content
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_giant_bot_room_message ON public.room_messages;
CREATE TRIGGER trg_giant_bot_room_message
AFTER INSERT ON public.room_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_giant_bot_room_message();

-- ============ DM webhook ============
CREATE OR REPLACE FUNCTION public.tg_giant_bot_dm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE
  _url text;
  _secret text;
  _bot uuid := public.giant_bot_id();
BEGIN
  IF NEW.receiver_id <> _bot THEN RETURN NEW; END IF;
  IF NEW.sender_id = _bot THEN RETURN NEW; END IF;
  IF NEW.message_type <> 'text' THEN RETURN NEW; END IF;
  IF length(COALESCE(btrim(NEW.content),'')) = 0 THEN RETURN NEW; END IF;

  SELECT value INTO _url FROM public.bot_config WHERE key='webhook_url';
  SELECT value INTO _secret FROM public.bot_config WHERE key='webhook_secret';
  IF _url IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-bot-secret', _secret
    ),
    body := jsonb_build_object(
      'kind','dm',
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'content', NEW.content
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_giant_bot_dm ON public.direct_messages;
CREATE TRIGGER trg_giant_bot_dm
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_giant_bot_dm();