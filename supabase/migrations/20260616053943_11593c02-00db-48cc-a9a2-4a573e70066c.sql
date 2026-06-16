
-- 1) Hash bot_subagents.password and lock down column access
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.tg_hash_bot_subagent_password()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.password IS NULL OR length(btrim(NEW.password)) = 0 THEN
    RETURN NEW;
  END IF;
  -- Skip if already a bcrypt hash
  IF NEW.password ~ '^\$2[aby]\$' THEN
    RETURN NEW;
  END IF;
  NEW.password := extensions.crypt(NEW.password, extensions.gen_salt('bf'));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bot_subagents_hash_password ON public.bot_subagents;
CREATE TRIGGER bot_subagents_hash_password
  BEFORE INSERT OR UPDATE OF password ON public.bot_subagents
  FOR EACH ROW EXECUTE FUNCTION public.tg_hash_bot_subagent_password();

-- Hash any existing plaintext rows
UPDATE public.bot_subagents
   SET password = extensions.crypt(password, extensions.gen_salt('bf'))
 WHERE password IS NOT NULL
   AND password !~ '^\$2[aby]\$';

-- Prevent client-side reads of the password column entirely
REVOKE SELECT ON public.bot_subagents FROM authenticated;
GRANT SELECT (id, owner_id, name, room_id, silent, created_at)
  ON public.bot_subagents TO authenticated;

-- 2) Tighten realtime DM channel authorization to exact UID match
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'realtime' AND tablename = 'messages'
       AND policyname ILIKE '%channel auth%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime.messages', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "dm channel auth select"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    split_part(realtime.topic(), ':', 2) = auth.uid()::text
    OR realtime.topic() NOT LIKE 'dm-msg:%'
       AND realtime.topic() NOT LIKE 'dm-presence:%'
       AND realtime.topic() NOT LIKE 'dm-unread:%'
       AND realtime.topic() NOT LIKE 'user:%'
       AND realtime.topic() NOT LIKE 'profile:%'
       AND realtime.topic() NOT LIKE 'friends:%'
       AND realtime.topic() NOT LIKE 'notifications:%'
  );

CREATE POLICY "dm channel auth insert"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    split_part(realtime.topic(), ':', 2) = auth.uid()::text
    OR realtime.topic() NOT LIKE 'dm-msg:%'
       AND realtime.topic() NOT LIKE 'dm-presence:%'
       AND realtime.topic() NOT LIKE 'dm-unread:%'
       AND realtime.topic() NOT LIKE 'user:%'
       AND realtime.topic() NOT LIKE 'profile:%'
       AND realtime.topic() NOT LIKE 'friends:%'
       AND realtime.topic() NOT LIKE 'notifications:%'
  );
