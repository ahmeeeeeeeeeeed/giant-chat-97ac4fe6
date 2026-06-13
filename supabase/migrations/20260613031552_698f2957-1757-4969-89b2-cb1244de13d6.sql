
-- 1) Add recovery email columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recovery_email text,
  ADD COLUMN IF NOT EXISTS recovery_email_verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_recovery_email_verified_idx
  ON public.profiles (lower(recovery_email))
  WHERE recovery_email_verified_at IS NOT NULL;

-- 2) Verification codes table
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('verify_email','recover_password')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_codes TO authenticated;
GRANT ALL ON public.verification_codes TO service_role;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Only service_role uses this table directly; deny clients
CREATE POLICY "deny all to users" ON public.verification_codes
  FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS verification_codes_user_purpose_idx
  ON public.verification_codes (user_id, purpose, created_at DESC);

-- 3) RPC: issue a code for verifying the current user's recovery email
CREATE OR REPLACE FUNCTION public.issue_email_verification_code(_email text)
RETURNS TABLE (code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
  _exp timestamptz := now() + interval '15 minutes';
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF _email IS NULL OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  _code := lpad(floor(random()*1000000)::int::text, 6, '0');
  -- save email tentatively (not verified)
  UPDATE public.profiles
    SET recovery_email = _email,
        recovery_email_verified_at = NULL
    WHERE id = _uid;
  INSERT INTO public.verification_codes(user_id, email, code, purpose, expires_at)
    VALUES (_uid, lower(_email), _code, 'verify_email', _exp);
  RETURN QUERY SELECT _code, _exp;
END $$;

REVOKE ALL ON FUNCTION public.issue_email_verification_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.issue_email_verification_code(text) TO authenticated;

-- 4) RPC: confirm the code for current user
CREATE OR REPLACE FUNCTION public.confirm_email_verification_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.verification_codes%rowtype;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT * INTO _row FROM public.verification_codes
    WHERE user_id = _uid AND purpose = 'verify_email'
      AND used_at IS NULL AND expires_at > now() AND code = _code
    ORDER BY created_at DESC LIMIT 1;
  IF _row.id IS NULL THEN RETURN false; END IF;
  UPDATE public.verification_codes SET used_at = now() WHERE id = _row.id;
  UPDATE public.profiles
    SET recovery_email = _row.email,
        recovery_email_verified_at = now()
    WHERE id = _uid;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.confirm_email_verification_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_email_verification_code(text) TO authenticated;

-- 5) Public lookup: find user id by verified recovery email (returns code + uid in private structure)
--    We expose only an RPC that issues a code; it returns the code (caller emails it).
CREATE OR REPLACE FUNCTION public.issue_recovery_code(_username text, _email text)
RETURNS TABLE (code text, expires_at timestamptz, user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _stored_email text;
  _code text;
  _exp timestamptz := now() + interval '15 minutes';
BEGIN
  IF _username IS NULL OR _email IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  SELECT id, recovery_email INTO _uid, _stored_email
    FROM public.profiles
    WHERE lower(username) = lower(_username)
      AND lower(recovery_email) = lower(_email)
      AND recovery_email_verified_at IS NOT NULL
    LIMIT 1;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  _code := lpad(floor(random()*1000000)::int::text, 6, '0');
  INSERT INTO public.verification_codes(user_id, email, code, purpose, expires_at)
    VALUES (_uid, lower(_stored_email), _code, 'recover_password', _exp);
  RETURN QUERY SELECT _code, _exp, _uid, _stored_email;
END $$;

-- Only service_role calls this (from server function), never the client
REVOKE ALL ON FUNCTION public.issue_recovery_code(text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.issue_recovery_code(text,text) TO service_role;

-- 6) RPC: verify recovery code (server-side check, returns user_id when valid)
CREATE OR REPLACE FUNCTION public.consume_recovery_code(_username text, _code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _row public.verification_codes%rowtype;
BEGIN
  SELECT id INTO _uid FROM public.profiles WHERE lower(username) = lower(_username) LIMIT 1;
  IF _uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO _row FROM public.verification_codes
    WHERE user_id = _uid AND purpose = 'recover_password'
      AND used_at IS NULL AND expires_at > now() AND code = _code
    ORDER BY created_at DESC LIMIT 1;
  IF _row.id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.verification_codes SET used_at = now() WHERE id = _row.id;
  RETURN _uid;
END $$;

REVOKE ALL ON FUNCTION public.consume_recovery_code(text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_recovery_code(text,text) TO service_role;
