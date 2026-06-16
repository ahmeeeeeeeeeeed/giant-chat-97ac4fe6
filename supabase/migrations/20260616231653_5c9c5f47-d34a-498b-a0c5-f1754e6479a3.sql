CREATE OR REPLACE FUNCTION public.ota_publish_bundle(_version text, _url text, _message text DEFAULT NULL::text)
 RETURNS app_updates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.app_updates;
  _existing public.app_updates;
  _same_version public.app_updates;
  _parts text[];
  _version_code int;
  _matching_apk text;
  _latest_apk text;
BEGIN
  _parts := string_to_array(_version, '.');
  IF array_length(_parts, 1) = 3 THEN
    _version_code := (COALESCE(NULLIF(_parts[1], ''), '0')::int * 10000)
      + (COALESCE(NULLIF(_parts[2], ''), '0')::int * 100)
      + COALESCE(NULLIF(_parts[3], ''), '0')::int;
  ELSE
    _version_code := EXTRACT(EPOCH FROM now())::int;
  END IF;

  SELECT * INTO _existing
    FROM public.app_updates
   WHERE is_active = true
   ORDER BY version_code DESC LIMIT 1;

  SELECT * INTO _same_version
    FROM public.app_updates
   WHERE version = _version
   LIMIT 1;

  SELECT file_url INTO _matching_apk
    FROM public.app_updates
   WHERE file_url ILIKE '%.apk%'
     AND position(('giant-' || _version || '-') in lower(file_url)) > 0
   ORDER BY version_code DESC, updated_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  SELECT file_url INTO _latest_apk
    FROM public.app_updates
   WHERE file_url ILIKE '%.apk%'
   ORDER BY version_code DESC, updated_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  -- If a row with the same version already exists (e.g. created by the APK
  -- upload step earlier), update it in place and activate it.
  IF _same_version.id IS NOT NULL THEN
    UPDATE public.app_updates SET is_active = false WHERE id <> _same_version.id AND is_active = true;
    UPDATE public.app_updates
       SET web_bundle_url = _url,
           web_bundle_version = _version,
           file_url = COALESCE(
             _matching_apk,
             CASE WHEN _same_version.file_url ILIKE '%.apk%' THEN _same_version.file_url ELSE _latest_apk END
           ),
           version_code = GREATEST(_version_code, _same_version.version_code),
           update_message = COALESCE(_message, _same_version.update_message),
           is_active = true,
           updated_at = now()
     WHERE id = _same_version.id
     RETURNING * INTO _row;
    RETURN _row;
  END IF;

  IF _existing.id IS NOT NULL AND _existing.web_bundle_version = _version THEN
    UPDATE public.app_updates
       SET web_bundle_url = _url,
           web_bundle_version = _version,
           file_url = COALESCE(
             _matching_apk,
             CASE WHEN file_url ILIKE '%.apk%' THEN file_url ELSE _latest_apk END
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
    COALESCE(_existing.minimum_required_version, '1.0.0'),
    COALESCE(_existing.minimum_required_code, 10000),
    COALESCE(_message, 'تحديث جديد متاح'),
    'optional',
    COALESCE(_matching_apk, _latest_apk),
    true,
    _url, _version,
    _existing.web_bundle_url, _existing.web_bundle_version
  ) RETURNING * INTO _row;

  RETURN _row;
END;
$function$;