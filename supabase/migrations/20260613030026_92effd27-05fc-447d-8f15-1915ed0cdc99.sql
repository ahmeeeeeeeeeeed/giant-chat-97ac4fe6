
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

-- Create the official bot auth user + profile
DO $$
DECLARE _bot_id uuid;
BEGIN
  SELECT id INTO _bot_id FROM public.profiles WHERE is_bot=true LIMIT 1;
  IF _bot_id IS NULL THEN
    _bot_id := gen_random_uuid();
    INSERT INTO auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (_bot_id, '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
      'bimo-bot@system.local', crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username','BIMO BOT'),
      now(), now());
    INSERT INTO public.profiles(id, username, is_bot, bio)
    VALUES (_bot_id, 'BIMO_BOT', true, '🤖 بوت رسمي — أرسل "help" لرؤية الأوامر')
    ON CONFLICT (id) DO UPDATE SET is_bot=true, username='BIMO_BOT';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bot_subagents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  password text NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  silent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_subagents TO authenticated;
GRANT ALL ON public.bot_subagents TO service_role;
ALTER TABLE public.bot_subagents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_manages_subagents" ON public.bot_subagents FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.handle_bot_dm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _bot_id uuid;
  _sender uuid := NEW.sender_id;
  _txt text := COALESCE(NEW.content,'');
  _parts text[];
  _cmd text;
  _reply text := '';
  _room_id uuid;
  _target uuid;
  _rank room_rank;
  _sub public.bot_subagents%ROWTYPE;
BEGIN
  SELECT id INTO _bot_id FROM public.profiles WHERE is_bot=true ORDER BY created_at LIMIT 1;
  IF _bot_id IS NULL OR NEW.receiver_id <> _bot_id OR _sender = _bot_id THEN RETURN NEW; END IF;

  _parts := string_to_array(btrim(_txt), '@');

  IF lower(btrim(_txt)) IN ('help','مساعدة','?','/help') THEN
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

          -- Sub-bot announces action (if not silent)
          IF NOT _sub.silent AND _reply NOT LIKE '❌%' THEN
            INSERT INTO room_messages(room_id,user_id,content,message_type,meta)
              VALUES (_room_id,NULL,'🤖 ['||_sub.name||'] '||_reply,'system',
                      jsonb_build_object('kind','bot_action','bot',_sub.name));
          END IF;
        END IF;
      END IF;
    END IF;
  ELSE
    _reply := '🤖 لم أفهم الأمر. أرسل "help" للقائمة.';
  END IF;

  IF _reply <> '' THEN
    PERFORM set_config('session_replication_role','replica',true);
    INSERT INTO public.direct_messages(sender_id,receiver_id,content,message_type)
      VALUES (_bot_id,_sender,_reply,'text');
    PERFORM set_config('session_replication_role','origin',true);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bot_dm_handler ON public.direct_messages;
CREATE TRIGGER bot_dm_handler AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_bot_dm();

CREATE OR REPLACE FUNCTION public.get_bot_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.profiles WHERE is_bot=true ORDER BY created_at LIMIT 1
$$;
