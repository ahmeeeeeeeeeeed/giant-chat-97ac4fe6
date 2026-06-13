
CREATE OR REPLACE FUNCTION public.admin_get_password_hash(_target uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _h text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT encrypted_password INTO _h FROM auth.users WHERE id=_target;
  RETURN _h;
END $$;
