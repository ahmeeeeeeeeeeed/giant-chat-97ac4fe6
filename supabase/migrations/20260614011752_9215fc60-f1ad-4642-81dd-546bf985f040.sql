
-- 1) Hide game_rounds.secret from clients (only SECURITY DEFINER functions need it)
REVOKE SELECT (secret) ON public.game_rounds FROM authenticated;
REVOKE SELECT (secret) ON public.game_rounds FROM anon;

-- 2) Hide recovery email columns from other users; clients use get_my_recovery_status()
REVOKE SELECT (recovery_email, recovery_email_verified_at) ON public.profiles FROM authenticated;
REVOKE SELECT (recovery_email, recovery_email_verified_at) ON public.profiles FROM anon;

-- 3) Hash bot_subagents.password at rest, and never return it in SELECT
CREATE OR REPLACE FUNCTION public.bot_subagents_hash_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.password IS NOT NULL AND length(NEW.password) > 0
     AND NEW.password NOT LIKE '$2%$%' THEN
    NEW.password := extensions.crypt(NEW.password, extensions.gen_salt('bf'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bot_subagents_hash_password_trg ON public.bot_subagents;
CREATE TRIGGER bot_subagents_hash_password_trg
BEFORE INSERT OR UPDATE OF password ON public.bot_subagents
FOR EACH ROW EXECUTE FUNCTION public.bot_subagents_hash_password();

-- Hash any existing plaintext rows
UPDATE public.bot_subagents
   SET password = extensions.crypt(password, extensions.gen_salt('bf'))
 WHERE password IS NOT NULL AND password NOT LIKE '$2%$%';

REVOKE SELECT (password) ON public.bot_subagents FROM authenticated;
REVOKE SELECT (password) ON public.bot_subagents FROM anon;
