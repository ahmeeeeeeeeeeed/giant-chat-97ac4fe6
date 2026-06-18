
-- 1) Fix room_join: owners + invitees bypass password for private rooms
CREATE OR REPLACE FUNCTION public.room_join(_room uuid, _password text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _r public.rooms%ROWTYPE;
  _count int;
  _bypass boolean := false;
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
    _bypass := (_r.owner_id = _uid)
            OR EXISTS (SELECT 1 FROM public.room_invites WHERE room_id = _r.id AND user_id = _uid)
            OR public.has_role(_uid, 'admin'::app_role);
    IF NOT _bypass THEN
      IF _r.password_hash IS NULL THEN
        RAISE EXCEPTION 'not_invited';
      END IF;
      IF _password IS NULL OR _password = ''
         OR _r.password_hash <> extensions.crypt(_password, _r.password_hash) THEN
        RAISE EXCEPTION 'wrong_password';
      END IF;
    END IF;
  END IF;
  SELECT count(*) INTO _count FROM public.room_members WHERE room_id = _r.id;
  IF _count >= _r.max_members THEN RAISE EXCEPTION 'room_full'; END IF;
  INSERT INTO public.room_members(room_id, user_id, rank)
  VALUES (_r.id, _uid, CASE WHEN _r.owner_id = _uid THEN 'owner'::room_rank ELSE 'member'::room_rank END);
END $function$;

-- 2) Helper: post a bot system message
CREATE OR REPLACE FUNCTION public.giant_bot_say(_room uuid, _text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.room_messages(room_id, user_id, content, message_type)
  VALUES (_room, public.giant_bot_id(), _text, 'text');
END $$;

-- 3) Deterministic admin command executor — runs synchronously inside the trigger
CREATE OR REPLACE FUNCTION public.giant_bot_execute_command(
  _room uuid, _actor uuid, _content text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _bot uuid := public.giant_bot_id();
  _norm text;
  _action text := NULL;
  _name text := NULL;
  _target uuid;
  _target_name text;
  _can_admin boolean;
  _owner uuid;
  _matches text[];
BEGIN
  IF _actor IS NULL OR _actor = _bot THEN RETURN false; END IF;
  IF _content IS NULL OR length(btrim(_content)) = 0 THEN RETURN false; END IF;

  -- normalize arabic
  _norm := lower(_content);
  _norm := regexp_replace(_norm, '[ًٌٍَُِّْـ]', '', 'g');
  _norm := translate(_norm, 'إأآا', 'اااا');
  _norm := replace(_norm, 'ى', 'ي');
  _norm := replace(_norm, 'ة', 'ه');

  -- detect action (order matters)
  IF _norm ~ 'فك\s*حظر' THEN _action := 'unban';
  ELSIF _norm ~ '(^|\s)(احظر|حظر)(\s|$)' THEN _action := 'ban';
  ELSIF _norm ~ '(اطرد|طرد)' THEN _action := 'kick';
  ELSIF _norm ~ 'فك\s*كتم|افتح\s+كتم' THEN _action := 'unmute';
  ELSIF _norm ~ '(اكتم|كتم)' THEN _action := 'mute';
  ELSIF _norm ~ '(ارفع|رفع).*(اونر|مالك)' THEN _action := 'promote_owner';
  ELSIF _norm ~ '(ارفع|رفع).*(مشرف|ادمن|مسؤول|مسئول)' THEN _action := 'promote_admin';
  ELSIF _norm ~ '(انزل|نزل).*(مشرف|ادمن|مسؤول|مسئول|عضو)' THEN _action := 'demote_admin';
  ELSIF _norm ~ '(امنح|منح|اعط).*(mas|ماس)' THEN _action := 'grant_mas';
  ELSIF _norm ~ '(اسحب|سحب|ازل|الغ).*(mas|ماس)' THEN _action := 'revoke_mas';
  ELSE
    RETURN false;
  END IF;

  -- extract target: prefer @username, else after a connector word
  _matches := regexp_match(_content, '@([A-Za-z0-9_\u0600-\u06FF\.\-]{2,32})');
  IF _matches IS NOT NULL THEN
    _name := _matches[1];
  ELSE
    -- try after "من" or "ل" or after the action keyword
    _matches := regexp_match(_content, '(?:من|عن|عضو|المستخدم|على|الى|إلى)\s+([A-Za-z0-9_\u0600-\u06FF\.\-]{2,32})');
    IF _matches IS NOT NULL THEN
      _name := _matches[1];
    END IF;
  END IF;

  -- fallback: pick the first non-keyword token of length >=2
  IF _name IS NULL THEN
    SELECT t INTO _name FROM (
      SELECT regexp_split_to_table(_content, '\s+') AS t
    ) s
    WHERE length(t) >= 2
      AND lower(t) NOT IN ('بوت','giant','@admin','@بوت','احظر','حظر','اطرد','طرد','اكتم','كتم','افتح','فك','ارفع','رفع','انزل','نزل','أنزل','امنح','منح','اسحب','سحب','مشرف','أونر','اونر','مالك','المالك','هذا','هذه','من','عن','إلى','الى','على','عضو','المستخدم','مستخدم','الحساب','حساب','رتبه','رتبة','mas','ماس','ادمن','مسؤول','مسئول','اعط','ازل','الغ','يا','ال')
    LIMIT 1;
  END IF;

  IF _name IS NULL THEN RETURN false; END IF;
  _name := regexp_replace(_name, '^@', '');

  -- permission check
  SELECT public.has_bot_admin(_actor, _room) INTO _can_admin;
  IF NOT _can_admin THEN
    PERFORM public.giant_bot_say(_room, '🚫 فقط مالك الغرفة أو من يملك صلاحية MAS يمكنه إعطاء أوامر إدارية.');
    INSERT INTO public.bot_logs(room_id, actor_id, action, args, success, error)
    VALUES (_room, _actor, 'denied', jsonb_build_object('content', _content), false, 'not_authorized');
    RETURN true;
  END IF;

  -- resolve target: prefer current room members
  SELECT rm.user_id, p.username INTO _target, _target_name
  FROM public.room_members rm
  JOIN public.profiles p ON p.id = rm.user_id
  WHERE rm.room_id = _room
    AND lower(p.username) = lower(_name)
  LIMIT 1;

  IF _target IS NULL THEN
    SELECT rm.user_id, p.username INTO _target, _target_name
    FROM public.room_members rm
    JOIN public.profiles p ON p.id = rm.user_id
    WHERE rm.room_id = _room
      AND p.username ILIKE _name || '%'
    LIMIT 1;
  END IF;

  IF _target IS NULL THEN
    SELECT id, username INTO _target, _target_name
    FROM public.profiles
    WHERE lower(username) = lower(_name)
    LIMIT 1;
  END IF;

  IF _target IS NULL THEN
    SELECT id, username INTO _target, _target_name
    FROM public.profiles
    WHERE username ILIKE _name || '%'
    LIMIT 1;
  END IF;

  IF _target IS NULL THEN
    PERFORM public.giant_bot_say(_room, '❓ لم أجد مستخدماً باسم "' || _name || '".');
    RETURN true;
  END IF;

  IF _target = _bot THEN
    PERFORM public.giant_bot_say(_room, '🛡️ لا يمكنني تنفيذ هذا الأمر على نفسي.');
    RETURN true;
  END IF;

  SELECT owner_id INTO _owner FROM public.rooms WHERE id = _room;

  IF _action = 'ban' THEN
    IF _target = _owner THEN
      PERFORM public.giant_bot_say(_room, '🚫 لا يمكن حظر مالك الغرفة.');
      RETURN true;
    END IF;
    INSERT INTO public.room_bans(room_id, user_id, banned_by, reason)
    VALUES (_room, _target, _actor, 'via giant bot')
    ON CONFLICT (room_id, user_id) DO NOTHING;
    DELETE FROM public.room_members WHERE room_id = _room AND user_id = _target;
    PERFORM public.giant_bot_say(_room, '🚫 تم حظر ' || _target_name || ' من الغرفة.');

  ELSIF _action = 'unban' THEN
    DELETE FROM public.room_bans WHERE room_id = _room AND user_id = _target;
    PERFORM public.giant_bot_say(_room, '✅ تم فك حظر ' || _target_name || '.');

  ELSIF _action = 'kick' THEN
    IF _target = _owner THEN
      PERFORM public.giant_bot_say(_room, '🚫 لا يمكن طرد مالك الغرفة.');
      RETURN true;
    END IF;
    DELETE FROM public.room_members WHERE room_id = _room AND user_id = _target;
    PERFORM public.giant_bot_say(_room, '👋 تم طرد ' || _target_name || ' من الغرفة.');

  ELSIF _action = 'mute' THEN
    UPDATE public.room_members SET muted = true WHERE room_id = _room AND user_id = _target;
    PERFORM public.giant_bot_say(_room, '🔇 تم كتم ' || _target_name || '.');

  ELSIF _action = 'unmute' THEN
    UPDATE public.room_members SET muted = false WHERE room_id = _room AND user_id = _target;
    PERFORM public.giant_bot_say(_room, '🔊 تم فك كتم ' || _target_name || '.');

  ELSIF _action = 'promote_admin' THEN
    INSERT INTO public.room_members(room_id, user_id, rank)
    VALUES (_room, _target, 'admin'::room_rank)
    ON CONFLICT (room_id, user_id) DO UPDATE SET rank = 'admin'::room_rank;
    PERFORM public.giant_bot_say(_room, '⭐ تم ترقية ' || _target_name || ' إلى مشرف.');

  ELSIF _action = 'demote_admin' THEN
    UPDATE public.room_members SET rank = 'member'::room_rank
      WHERE room_id = _room AND user_id = _target AND rank <> 'owner'::room_rank;
    PERFORM public.giant_bot_say(_room, '↘️ تم تنزيل ' || _target_name || ' إلى عضو.');

  ELSIF _action = 'promote_owner' THEN
    IF _owner <> _actor THEN
      PERFORM public.giant_bot_say(_room, '🚫 فقط المالك الحالي يمكنه نقل الملكية.');
      RETURN true;
    END IF;
    UPDATE public.rooms SET owner_id = _target WHERE id = _room;
    INSERT INTO public.room_members(room_id, user_id, rank)
    VALUES (_room, _target, 'owner'::room_rank)
    ON CONFLICT (room_id, user_id) DO UPDATE SET rank = 'owner'::room_rank;
    UPDATE public.room_members SET rank = 'admin'::room_rank
      WHERE room_id = _room AND user_id = _actor;
    PERFORM public.giant_bot_say(_room, '👑 تم نقل ملكية الغرفة إلى ' || _target_name || '.');

  ELSIF _action = 'grant_mas' THEN
    INSERT INTO public.bot_permissions(room_id, user_id, granted_by)
    VALUES (_room, _target, _actor)
    ON CONFLICT (room_id, user_id) DO NOTHING;
    PERFORM public.giant_bot_say(_room, '🎖️ تم منح ' || _target_name || ' صلاحية وكيل البوت (MAS).');

  ELSIF _action = 'revoke_mas' THEN
    DELETE FROM public.bot_permissions WHERE room_id = _room AND user_id = _target;
    PERFORM public.giant_bot_say(_room, '❌ تم سحب صلاحية MAS من ' || _target_name || '.');
  END IF;

  INSERT INTO public.bot_logs(room_id, actor_id, target_id, action, args, success)
  VALUES (_room, _actor, _target, _action,
          jsonb_build_object('content', _content, 'target_username', _target_name), true);

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  PERFORM public.giant_bot_say(_room, '⚠️ فشل تنفيذ الأمر: ' || SQLERRM);
  INSERT INTO public.bot_logs(room_id, actor_id, target_id, action, args, success, error)
  VALUES (_room, _actor, _target, COALESCE(_action,'unknown'),
          jsonb_build_object('content', _content), false, SQLERRM);
  RETURN true;
END $$;

-- 4) Hook executor into the room-message trigger BEFORE the webhook fan-out
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
  _handled boolean := false;
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

  -- Try deterministic admin command first
  _handled := public.giant_bot_execute_command(NEW.room_id, NEW.user_id, _content);
  IF _handled THEN RETURN NEW; END IF;

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
