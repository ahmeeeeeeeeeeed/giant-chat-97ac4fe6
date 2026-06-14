
-- Trigger: auto-grant admin role when a profile is created/updated with username='admin'
CREATE OR REPLACE FUNCTION public.auto_grant_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(btrim(NEW.username)) = 'admin' THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_grant_owner_role ON public.profiles;
CREATE TRIGGER trg_auto_grant_owner_role
AFTER INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_grant_owner_role();

-- Backfill if admin already exists
INSERT INTO public.user_roles(user_id, role)
SELECT id, 'admin'::app_role FROM public.profiles WHERE lower(username) = 'admin'
ON CONFLICT DO NOTHING;
