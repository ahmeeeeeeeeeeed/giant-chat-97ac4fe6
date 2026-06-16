
-- Phase 1: Room backgrounds + Profile covers + Room password management

-- 1) Room backgrounds (owner-only updatable; visible to members via existing room SELECT policies)
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS background_url text,
  ADD COLUMN IF NOT EXISTS background_type text;

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_background_type_check;
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_background_type_check
  CHECK (background_type IS NULL OR background_type IN ('image','gif','video'));

-- 2) Profile cover
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS cover_type text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cover_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cover_type_check
  CHECK (cover_type IS NULL OR cover_type IN ('image','gif','video'));

-- 3) RPC: set room background (owner only)
CREATE OR REPLACE FUNCTION public.set_room_background(_room uuid, _url text, _type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT owner_id INTO _owner FROM public.rooms WHERE id = _room;
  IF _owner IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF _owner <> auth.uid() THEN RAISE EXCEPTION 'owner_only'; END IF;
  IF _type IS NOT NULL AND _type NOT IN ('image','gif','video') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;
  UPDATE public.rooms SET background_url = _url, background_type = _type WHERE id = _room;
END $$;

-- 4) RPC: set room password (owner only; '' or NULL removes password)
CREATE OR REPLACE FUNCTION public.set_room_password(_room uuid, _password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE _owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT owner_id INTO _owner FROM public.rooms WHERE id = _room;
  IF _owner IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF _owner <> auth.uid() THEN RAISE EXCEPTION 'owner_only'; END IF;

  IF _password IS NULL OR length(btrim(_password)) = 0 THEN
    UPDATE public.rooms
      SET password_hash = NULL,
          type = 'public'
      WHERE id = _room;
  ELSE
    UPDATE public.rooms
      SET password_hash = extensions.crypt(_password, extensions.gen_salt('bf')),
          type = 'private'
      WHERE id = _room;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.set_room_background(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_room_password(uuid, text) TO authenticated;

-- 5) Profile cover RPC (owner of profile only)
CREATE OR REPLACE FUNCTION public.set_profile_cover(_url text, _type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _type IS NOT NULL AND _type NOT IN ('image','gif','video') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;
  UPDATE public.profiles SET cover_url = _url, cover_type = _type WHERE id = auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION public.set_profile_cover(text, text) TO authenticated;

-- 6) Allow cover_url & cover_type direct updates by owner via the existing guard trigger
--    (guard trigger only blocks privileged columns; cover_* are not in the protected list, so direct updates work too)
