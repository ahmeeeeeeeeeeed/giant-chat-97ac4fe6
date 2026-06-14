CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _is_admin boolean := false;
BEGIN
  -- Trusted contexts: SECURITY DEFINER RPCs and superuser bypass this check.
  -- PostgREST runs as the 'authenticated' / 'anon' role; everything else is server-trusted.
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN NEW;
  END IF;

  BEGIN
    _is_admin := public.has_role(auth.uid(), 'admin');
  EXCEPTION WHEN OTHERS THEN
    _is_admin := false;
  END;

  IF _is_admin THEN
    RETURN NEW;
  END IF;

  -- Force sensitive columns back to OLD values for non-admin direct updates.
  NEW.points := OLD.points;
  NEW.game_wins := OLD.game_wins;
  NEW.is_banned := OLD.is_banned;
  NEW.ban_reason := OLD.ban_reason;
  NEW.is_premium := OLD.is_premium;
  NEW.is_bot := OLD.is_bot;
  NEW.profile_views := OLD.profile_views;
  NEW.auth_email := OLD.auth_email;
  NEW.recovery_email_verified_at := OLD.recovery_email_verified_at;
  -- id is also immutable from client perspective
  NEW.id := OLD.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_updates_trg ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_updates_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_privileged_updates();