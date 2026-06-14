-- Premium account support
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_email text;

-- Backfill auth_email for existing users so unified login works
UPDATE public.profiles p
   SET auth_email = u.email
  FROM auth.users u
 WHERE p.id = u.id AND p.auth_email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_email_lower_idx
  ON public.profiles (lower(auth_email)) WHERE auth_email IS NOT NULL;

-- Lookup auth email by username (case-insensitive) for login
CREATE OR REPLACE FUNCTION public.lookup_auth_email(_username text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth_email FROM public.profiles
   WHERE lower(username) = lower(btrim(_username))
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_auth_email(text) TO anon, authenticated;

-- Atomic check + deduct 50k points for premium purchase
CREATE OR REPLACE FUNCTION public.premium_charge_points(_cost integer DEFAULT 50000)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _pts int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT points INTO _pts FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF COALESCE(_pts,0) < _cost THEN RAISE EXCEPTION 'insufficient_points'; END IF;
  UPDATE public.profiles SET points = points - _cost WHERE id = _uid;
END $$;

GRANT EXECUTE ON FUNCTION public.premium_charge_points(integer) TO authenticated;

-- Mark a profile as premium (called by server function after auth user created)
CREATE OR REPLACE FUNCTION public.mark_profile_premium(_target uuid, _username text, _email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET is_premium = true,
         username = btrim(_username),
         auth_email = lower(_email)
   WHERE id = _target;
END $$;

GRANT EXECUTE ON FUNCTION public.mark_profile_premium(uuid, text, text) TO service_role;