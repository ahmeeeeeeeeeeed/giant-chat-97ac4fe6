CREATE OR REPLACE FUNCTION public.ota_publish_bundle(
  _version text,
  _url text,
  _message text DEFAULT NULL
) RETURNS public.app_updates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.app_updates;
  _existing public.app_updates;
  _parts text[];
  _version_code int;
  _matching_apk text;
BEGIN
  _parts := string_to_array(_version, '.');
  IF array_length(_parts, 1) = 3 THEN
    _version_code := (COALESCE(NULLIF(_parts[1], ''), '0')::int * 10000)
      + (COALESCE(NULLIF(_parts[2], ''), '0')::int * 100)
      + COALESCE(NULLIF(_parts[3], ''), '0')::int;
  ELSE
    _version_code := EXTRACT(EPOCH FROM now())::int;
  END IF;

  SELECT * INTO _existing FROM public.app_updates
   WHERE is_active = true
   ORDER BY version_code DESC LIMIT 1;

  SELECT file_url INTO _matching_apk
    FROM public.app_updates
   WHERE file_url ILIKE '%.apk%'
     AND position(('giant-' || _version || '-') in lower(file_url)) > 0
   ORDER BY version_code DESC, updated_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF _existing.id IS NOT NULL AND _existing.web_bundle_version = _version THEN
    UPDATE public.app_updates
       SET web_bundle_url = _url,
           web_bundle_version = _version,
           file_url = COALESCE(
             _matching_apk,
             CASE
               WHEN file_url ILIKE '%.apk%' AND position(('giant-' || _version || '-') in lower(file_url)) = 0 THEN _url
               ELSE file_url
             END,
             _url
           ),
           version_code = GREATEST(_version_code, _existing.version_code),
           version = _version,
           update_message = COALESCE(_message, update_message),
           updated_at = now()
     WHERE id = _existing.id
     RETURNING * INTO _row;
    RETURN _row;
  END IF;

  UPDATE public.app_updates SET is_active = false WHERE is_active = true;

  INSERT INTO public.app_updates (
    version, version_code, minimum_required_version, minimum_required_code,
    update_message, update_type, file_url, is_active,
    web_bundle_url, web_bundle_version,
    previous_web_bundle_url, previous_web_bundle_version
  ) VALUES (
    _version, GREATEST(_version_code, COALESCE(_existing.version_code, 0) + 1),
    COALESCE(_existing.minimum_required_version, _version),
    COALESCE(_existing.minimum_required_code, 0),
    COALESCE(_message, 'تحديث جديد متاح'),
    'optional',
    COALESCE(_matching_apk, _url),
    true,
    _url, _version,
    _existing.web_bundle_url, _existing.web_bundle_version
  ) RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.ota_publish_bundle(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ota_publish_bundle(text, text, text) TO service_role;