DO $$
DECLARE
  v_uid uuid := 'c4de2e75-17b3-41e1-b973-8ab47bddd3d8';
BEGIN
  DELETE FROM public.user_roles WHERE user_id = v_uid;
  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END $$;