CREATE OR REPLACE FUNCTION public.enforce_dm_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id IN (NEW.sender_id, NEW.receiver_id)
      AND p.is_bot = true
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.dm_blocks
    WHERE (blocker_id = NEW.receiver_id AND blocked_id = NEW.sender_id)
       OR (blocker_id = NEW.sender_id AND blocked_id = NEW.receiver_id))
  THEN
    RAISE EXCEPTION 'dm_blocked';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_dm_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  locked BOOLEAN;
  is_friend BOOLEAN;
BEGIN
  IF NEW.sender_id = NEW.receiver_id THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id IN (NEW.sender_id, NEW.receiver_id)
      AND p.is_bot = true
  ) THEN
    RETURN NEW;
  END IF;

  SELECT dm_locked INTO locked FROM public.profiles WHERE id = NEW.receiver_id;
  IF COALESCE(locked, false) = false THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = NEW.sender_id AND addressee_id = NEW.receiver_id)
        OR (requester_id = NEW.receiver_id AND addressee_id = NEW.sender_id))
  ) INTO is_friend;
  IF NOT is_friend THEN
    RAISE EXCEPTION 'recipient_dm_locked';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_bot_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _bot_id uuid := NEW.receiver_id;
  _bot_name text;
  _is_bot boolean;
  _sender uuid := NEW.sender_id;
  _txt text := COALESCE(NEW.content,'');
  _low text := lower(btrim(_txt));
  _parts text[];
  _cmd text;
  _reply text := '';
  _room_id uuid;
  _target uuid;
  _rank room_rank;
  _sub public.bot_subagents%ROWTYPE;
BEGIN
  IF NEW.receiver_id = public.giant_bot_id() OR NEW.sender_id = public.giant_bot_id() THEN
    RETURN NEW;
  END IF;

  SELECT is_bot, username INTO _is_bot, _bot_name
    FROM public.profiles WHERE id = _bot_id;
  IF NOT COALESCE(_is_bot,false) OR _sender = _bot_id THEN
    RETURN NEW;
  END IF;

  _parts := string_to_array(btrim(_txt), '@');

  IF _bot_name = 'WELCOME_BOT' THEN
    _reply := '👋 أهلاً ' || COALESCE((SELECT username FROM profiles WHERE id=_sender),'صديقي') ||
              '! أنا بوت الترحيب. تجوّل في الغرف واستمتع 🌟';
  ELSIF _bot_name = 'GAMES_BOT' THEN
    IF _low ~ '(لعب|game|x|o|حجر|ورق|مقص)' THEN
      _reply := '🎮 جرّب: حجرة/ورقة/مقص! اكتب رسالتك واخترع لعبة، أو اطلب "مسابقة".';
    ELSE
      _reply := '🎮 أنا بوت الألعاب. اكتب "لعب" لاقتراح لعبة.';
    END IF;
  ELSIF _bot_name = 'CONTEST_BOT' THEN
    _reply := '🏆 سؤال سريع: ما عاصمة المملكة العربية السعودية؟ (اكتب الإجابة هنا)';
  ELSIF _bot_name = 'ADMIN_BOT' THEN
    _reply := '🛡️ بوت الإدارة. الأوامر: mas@user, umas@user, kick@user, ban@user, unban@user, own@user';
  ELSIF _bot_name = 'REPLY_BOT' THEN
    IF _low ~ '(سلام|مرحب|هلا|اهلا|أهلا|hi|hello)' THEN
      _reply := '👋 وعليكم السلام! منوّر';
    ELSIF _low ~ '(شكر|thanks|مشكور)' THEN
      _reply := '🌹 العفو!';
    ELSE
      _reply := '💬 أنا هنا للرد. جرّب "سلام" أو "شكراً" أو اسألني شيئاً.';
    END IF;
  END IF;

  IF _bot_name IN ('BIMO_BOT') OR _reply = '' THEN
    IF _low IN ('help','مساعدة','?','/help') THEN
      _reply := '🤖 الأوامر:
• name@pwd@room — نشر بوت في غرفة
• hb@name@pwd@room — بوت صامت
• mas@user — ترقية إلى مشرف
• umas@user — إزالة الإشراف
• kick@user — طرد
• ban@user — حظر
• unban@user — فك حظر
• own@user — نقل الملكية';
    ELSIF array_length(_parts,1)=4 AND lower(_parts[1])='hb' THEN
      SELECT id INTO _room_id FROM public.rooms WHERE name=_parts[4] LIMIT 1;
      IF _room_id IS NULL THEN _reply := '❌ الغرفة غير موجودة: '||_parts[4];
      ELSE
        INSERT INTO public.bot_subagents(owner_id,name,password,room_id,silent)
          VALUES (_sender,_parts[2],_parts[3],_room_id,true);
        _reply := '🤫 نُشر بوت صامت «'||_parts[2]||'» في «'||_parts[4]||'»';
      END IF;
    ELSIF array_length(_parts,1)=3 AND lower(_parts[1]) NOT IN ('mas','umas','kick','ban','unban','own','hb') THEN
      SELECT id INTO _room_id FROM public.rooms WHERE name=_parts[3] LIMIT 1;
      IF _room_id IS NULL THEN _reply := '❌ الغرفة غير موجودة: '||_parts[3];
      ELSE
        INSERT INTO public.bot_subagents(owner_id,name,password,room_id,silent)
          VALUES (_sender,_parts[1],_parts[2],_room_id,false);
        INSERT INTO public.room_messages(room_id,user_id,content,message_type,meta)
          VALUES (_room_id,NULL,'🤖 انضم البوت «'||_parts[1]||'» إلى الغرفة','system',
                  jsonb_build_object('kind','bot_join','name',_parts[1]));
        _reply := '🤖 نُشر البوت «'||_parts[1]||'» في «'||_parts[3]||'»';
      END IF;
    ELSIF array_length(_parts,1)=2 AND lower(_parts[1]) IN ('mas','umas','kick','ban','unban','own') THEN
      _cmd := lower(_parts[1]);
      SELECT * INTO _sub FROM public.bot_subagents WHERE owner_id=_sender ORDER BY created_at DESC LIMIT 1;
      IF _sub.id IS NULL THEN _reply := '❌ انشر بوتاً في غرفة أولاً (name@pwd@room)';
      ELSE
        _room_id := _sub.room_id;
        SELECT id INTO _target FROM public.profiles WHERE username=_parts[2] LIMIT 1;
        IF _target IS NULL THEN _reply := '❌ مستخدم غير موجود: '||_parts[2];
        ELSE
          SELECT rank INTO _rank FROM public.room_members WHERE room_id=_room_id AND user_id=_sender;
          IF _rank IS NULL OR _rank NOT IN ('owner','admin') THEN
            _reply := '❌ لست مشرفاً أو مالكاً في الغرفة';
          ELSE
            PERFORM set_config('app.skip_leave_log','true',true);
            IF _cmd='kick' THEN
              IF (SELECT rank FROM room_members WHERE room_id=_room_id AND user_id=_target)='owner' THEN
                _reply := '❌ لا يمكن طرد المالك';
              ELSE
                DELETE FROM room_members WHERE room_id=_room_id AND user_id=_target;
                INSERT INTO room_logs(room_id,actor_id,target_id,event) VALUES (_room_id,_sender,_target,'kick');
                _reply := '⚠️ تم طرد '||_parts[2];
              END IF;
            ELSIF _cmd='ban' THEN
              IF (SELECT rank FROM room_members WHERE room_id=_room_id AND user_id=_target)='owner' THEN
                _reply := '❌ لا يمكن حظر المالك';
              ELSE
                DELETE FROM room_members WHERE room_id=_room_id AND user_id=_target;
                INSERT INTO room_bans(room_id,user_id,banned_by) VALUES (_room_id,_target,_sender)
                  ON CONFLICT (room_id,user_id) DO UPDATE SET banned_by=_sender;
                INSERT INTO room_logs(room_id,actor_id,target_id,event) VALUES (_room_id,_sender,_target,'ban');
                _reply := '🚫 تم حظر '||_parts[2];
              END IF;
            ELSIF _cmd='unban' THEN
              DELETE FROM room_bans WHERE room_id=_room_id AND user_id=_target;
              INSERT INTO room_logs(room_id,actor_id,target_id,event) VALUES (_room_id,_sender,_target,'unban');
              _reply := '✅ تم فك حظر '||_parts[2];
            ELSIF _cmd='mas' THEN
              IF _rank<>'owner' THEN _reply := '❌ المالك فقط';
              ELSE
                UPDATE room_members SET rank='admin' WHERE room_id=_room_id AND user_id=_target;
                INSERT INTO room_logs(room_id,actor_id,target_id,event,meta) VALUES (_room_id,_sender,_target,'promote',jsonb_build_object('rank','admin'));
                _reply := '⬆️ تمت ترقية '||_parts[2]||' إلى مشرف';
              END IF;
            ELSIF _cmd='umas' THEN
              IF _rank<>'owner' THEN _reply := '❌ المالك فقط';
              ELSE
                UPDATE room_members SET rank='member' WHERE room_id=_room_id AND user_id=_target;
                INSERT INTO room_logs(room_id,actor_id,target_id,event) VALUES (_room_id,_sender,_target,'demote');
                _reply := '⬇️ تم تخفيض '||_parts[2];
              END IF;
            ELSIF _cmd='own' THEN
              IF _rank<>'owner' THEN _reply := '❌ المالك فقط';
              ELSE
                UPDATE rooms SET owner_id=_target WHERE id=_room_id;
                UPDATE room_members SET rank='admin' WHERE room_id=_room_id AND user_id=_sender;
                UPDATE room_members SET rank='owner' WHERE room_id=_room_id AND user_id=_target;
                INSERT INTO room_logs(room_id,actor_id,target_id,event) VALUES (_room_id,_sender,_target,'transfer');
                _reply := '👑 نُقلت الملكية إلى '||_parts[2];
              END IF;
            END IF;

            IF NOT _sub.silent AND _reply NOT LIKE '❌%' THEN
              INSERT INTO room_messages(room_id,user_id,content,message_type,meta)
                VALUES (_room_id,NULL,'🤖 ['||_sub.name||'] '||_reply,'system',
                        jsonb_build_object('kind','bot_action','bot',_sub.name));
            END IF;
          END IF;
        END IF;
      END IF;
    ELSIF _reply = '' THEN
      _reply := '🤖 لم أفهم. أرسل "help" للأوامر.';
    END IF;
  END IF;

  IF _reply <> '' THEN
    INSERT INTO public.direct_messages(sender_id,receiver_id,content,message_type)
      VALUES (_bot_id,_sender,_reply,'text');
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_giant_bot_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
  IF COALESCE(btrim(_url),'') = '' OR COALESCE(btrim(_secret),'') = '' THEN RETURN NEW; END IF;

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
END $function$;

CREATE OR REPLACE FUNCTION public.tg_giant_bot_room_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _url text;
  _secret text;
  _bot uuid := public.giant_bot_id();
  _content text := COALESCE(NEW.content, '');
  _low text := lower(_content);
  _is_member boolean;
  _trigger_words text := 'بوت|giant|@admin|@بوت|احسب|اشرح|ترجم|لخص|ابحث|هات|احظر|اطرد|اكتم|افتح|ارفع|انزل|انزّل|أنزل|امنح|اسحب|فك|رفع|نزل';
BEGIN
  IF NEW.user_id IS NULL OR NEW.user_id = _bot THEN RETURN NEW; END IF;
  IF NEW.message_type <> 'text' THEN RETURN NEW; END IF;
  IF length(btrim(_content)) = 0 THEN RETURN NEW; END IF;

  SELECT EXISTS(SELECT 1 FROM public.room_members WHERE room_id=NEW.room_id AND user_id=_bot) INTO _is_member;
  IF NOT _is_member THEN
    INSERT INTO public.room_members(room_id, user_id, rank)
    VALUES (NEW.room_id, _bot, 'admin'::room_rank)
    ON CONFLICT (room_id, user_id) DO UPDATE SET rank='admin'::room_rank;
  END IF;

  IF _low !~ ('(' || _trigger_words || ')') THEN RETURN NEW; END IF;

  SELECT value INTO _url FROM public.bot_config WHERE key='webhook_url';
  SELECT value INTO _secret FROM public.bot_config WHERE key='webhook_secret';
  IF COALESCE(btrim(_url),'') = '' OR COALESCE(btrim(_secret),'') = '' THEN RETURN NEW; END IF;

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
END $function$;

INSERT INTO public.room_members(room_id, user_id, rank)
SELECT r.id, public.giant_bot_id(), 'admin'::room_rank
FROM public.rooms r
WHERE r.is_active = true
ON CONFLICT (room_id, user_id) DO UPDATE SET rank='admin'::room_rank;