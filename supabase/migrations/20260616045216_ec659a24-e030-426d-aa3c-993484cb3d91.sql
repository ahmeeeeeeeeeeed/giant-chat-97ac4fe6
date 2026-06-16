CREATE OR REPLACE FUNCTION public.purchase_premium_username(_new_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_points integer;
  v_clean text;
  v_cost integer := 50000;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_clean := btrim(coalesce(_new_username,''));
  IF length(v_clean) < 2 OR length(v_clean) > 32 THEN
    RAISE EXCEPTION 'invalid_length';
  END IF;
  IF v_clean ~ '[[:space:][:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid_chars';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE lower(username) = lower(v_clean)
       AND id <> v_uid
  ) THEN
    RAISE EXCEPTION 'username_taken';
  END IF;

  SELECT points INTO v_points FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_points IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
  IF v_points < v_cost THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  UPDATE public.profiles
     SET points = points - v_cost,
         username = v_clean
   WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_premium_username(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_premium_username(text) TO authenticated;