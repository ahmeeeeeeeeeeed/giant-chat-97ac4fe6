-- Fix active 11.0.0 update: point file_url to a real signed APK (not the .zip OTA bundle)
-- so legacy clients without OTA logic can still install without "package parse error".
-- The .zip OTA bundle stays in web_bundle_url for new clients to apply in-place.
UPDATE public.app_updates
SET file_url = (
  SELECT 'https://gfuusohydgpumgardbyn.supabase.co/storage/v1/object/public/app-updates/' || name
  FROM storage.objects
  WHERE bucket_id = 'app-updates'
    AND name LIKE 'apk/giant-%.apk'
  ORDER BY created_at DESC
  LIMIT 1
)
WHERE id = 'aca113ef-cae3-4267-8a0c-d505ee3afeb9';

-- Harden ota_publish_bundle so it NEVER writes a .zip into file_url.
CREATE OR REPLACE FUNCTION public.ota_publish_bundle(
  p_version text,
  p_version_code integer,
  p_bundle_url text,
  p_bundle_version text,
  p_message text,
  p_update_type text DEFAULT 'optional',
  p_min_version text DEFAULT NULL,
  p_min_code integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_apk_url text;
BEGIN
  -- Pick the newest APK that matches this version, else the most recent APK overall.
  SELECT 'https://gfuusohydgpumgardbyn.supabase.co/storage/v1/object/public/app-updates/' || name
    INTO v_apk_url
  FROM storage.objects
  WHERE bucket_id = 'app-updates'
    AND name LIKE 'apk/giant-' || p_version || '-%.apk'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_apk_url IS NULL THEN
    SELECT 'https://gfuusohydgpumgardbyn.supabase.co/storage/v1/object/public/app-updates/' || name
      INTO v_apk_url
    FROM storage.objects
    WHERE bucket_id = 'app-updates'
      AND name LIKE 'apk/giant-%.apk'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  UPDATE public.app_updates SET is_active = false WHERE is_active = true;

  INSERT INTO public.app_updates (
    version, version_code, file_url, web_bundle_url, web_bundle_version,
    update_message, update_type, minimum_required_version, minimum_required_code, is_active
  ) VALUES (
    p_version, p_version_code, COALESCE(v_apk_url, p_bundle_url), p_bundle_url, p_bundle_version,
    p_message, p_update_type, COALESCE(p_min_version, p_version), COALESCE(p_min_code, p_version_code), true
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;