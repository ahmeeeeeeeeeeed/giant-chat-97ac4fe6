
-- 1) Create 5 official bot users + profiles
DO $$
DECLARE
  _bots text[][] := ARRAY[
    ARRAY['welcome-bot@system.local','WELCOME_BOT','👋 بوت ترحيب — أرحب بكل عضو جديد'],
    ARRAY['contest-bot@system.local','CONTEST_BOT','🏆 بوت مسابقات — اكتب "مسابقة" لبدء سؤال'],
    ARRAY['games-bot@system.local','GAMES_BOT','🎮 بوت ألعاب — اكتب "لعبة" لاقتراح لعبة'],
    ARRAY['admin-bot@system.local','ADMIN_BOT','🛡️ بوت إدارة — يساعد المشرفين'],
    ARRAY['reply-bot@system.local','REPLY_BOT','💬 بوت ردود تلقائية — يرد على الكلمات المفتاحية']
  ];
  _row text[];
  _id uuid;
BEGIN
  FOREACH _row SLICE 1 IN ARRAY _bots LOOP
    SELECT id INTO _id FROM auth.users WHERE email=_row[1] LIMIT 1;
    IF _id IS NULL THEN
      _id := gen_random_uuid();
      INSERT INTO auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES (_id, '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
        _row[1], crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('username',_row[2]),
        now(), now());
    END IF;
    INSERT INTO public.profiles(id, username, is_bot, bio)
    VALUES (_id, _row[2], true, _row[3])
    ON CONFLICT (id) DO UPDATE SET is_bot=true, username=EXCLUDED.username, bio=EXCLUDED.bio;
  END LOOP;
END $$;

-- 2) Helper: insert all bots into a room
CREATE OR REPLACE FUNCTION public.add_all_bots_to_room(_room uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.room_members(room_id, user_id, rank)
  SELECT _room, p.id, 'member'::room_rank
  FROM public.profiles p
  WHERE p.is_bot = true
  ON CONFLICT (room_id, user_id) DO NOTHING;
END $$;

-- 3) Backfill: add bots to every existing room
DO $$
DECLARE _r uuid;
BEGIN
  FOR _r IN SELECT id FROM public.rooms LOOP
    PERFORM public.add_all_bots_to_room(_r);
  END LOOP;
END $$;

-- 4) Trigger: auto-add bots to new rooms
CREATE OR REPLACE FUNCTION public.tg_add_bots_to_new_room()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.add_all_bots_to_room(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_add_bots_to_new_room ON public.rooms;
CREATE TRIGGER trg_add_bots_to_new_room
AFTER INSERT ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.tg_add_bots_to_new_room();

-- 5) Trigger: welcome bot greets new (non-bot) members
CREATE OR REPLACE FUNCTION public.tg_welcome_new_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _is_bot boolean;
  _uname text;
BEGIN
  SELECT is_bot, username INTO _is_bot, _uname
  FROM public.profiles WHERE id = NEW.user_id;
  IF COALESCE(_is_bot,false) THEN RETURN NEW; END IF;

  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
  VALUES (
    NEW.room_id, NULL,
    '👋 أهلاً وسهلاً بـ ' || COALESCE(_uname,'العضو الجديد') || ' في الغرفة! نتمنى لك وقتاً ممتعاً 🌟',
    'system',
    jsonb_build_object('kind','bot_welcome','bot','WELCOME_BOT','user',_uname)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_welcome_new_member ON public.room_members;
CREATE TRIGGER trg_welcome_new_member
AFTER INSERT ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.tg_welcome_new_member();

-- 6) Trigger: auto-reply bot reacts to keywords in user messages
CREATE OR REPLACE FUNCTION public.tg_bot_auto_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _txt text;
  _is_bot boolean;
  _reply text := NULL;
  _bot text := 'REPLY_BOT';
  _kind text := 'bot_reply';
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.message_type <> 'text' THEN RETURN NEW; END IF;

  SELECT is_bot INTO _is_bot FROM public.profiles WHERE id = NEW.user_id;
  IF COALESCE(_is_bot,false) THEN RETURN NEW; END IF;

  _txt := lower(COALESCE(NEW.content,''));

  IF _txt ~ '(سلام|مرحب|هلا|اهلا|أهلا|hi|hello)' THEN
    _reply := '👋 وعليكم السلام! منوّر الغرفة';
  ELSIF _txt ~ '(مساعد|help|اوامر|أوامر)' THEN
    _reply := 'ℹ️ اكتب: "مسابقة" لبدء مسابقة، "لعبة" لاقتراح لعبة، أو "إدارة" لأوامر المشرفين';
  ELSIF _txt ~ '(مسابق|سؤال|quiz)' THEN
    _bot := 'CONTEST_BOT'; _kind := 'bot_contest';
    _reply := '🏆 سؤال: ما عاصمة المملكة العربية السعودية؟ (اكتب إجابتك)';
  ELSIF _txt ~ '(لعب|game|ألعاب|العاب)' THEN
    _bot := 'GAMES_BOT'; _kind := 'bot_games';
    _reply := '🎮 جرّب: حجرة/ورقة/مقص، أو X-O، أو اكتب "مسابقة" لسؤال سريع!';
  ELSIF _txt ~ '(إدارة|اداره|admin|مشرف)' THEN
    _bot := 'ADMIN_BOT'; _kind := 'bot_admin';
    _reply := '🛡️ أوامر الإدارة عبر الخاص مع البوت الرسمي: mas@user, kick@user, ban@user';
  ELSIF _txt ~ '(شكر|thanks|ثانكس|مشكور)' THEN
    _reply := '🌹 العفو! نحن هنا لخدمتك';
  END IF;

  IF _reply IS NOT NULL THEN
    INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
    VALUES (NEW.room_id, NULL, _reply, 'system',
            jsonb_build_object('kind',_kind,'bot',_bot));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bot_auto_reply ON public.room_messages;
CREATE TRIGGER trg_bot_auto_reply
AFTER INSERT ON public.room_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_bot_auto_reply();
