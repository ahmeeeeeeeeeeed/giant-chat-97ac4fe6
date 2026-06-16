-- OTA publish + rollback support
ALTER TABLE public.app_updates
  ADD COLUMN IF NOT EXISTS previous_web_bundle_url text,
  ADD COLUMN IF NOT EXISTS previous_web_bundle_version text;

-- Publish a new web bundle: saves current as previous, then sets new active.
-- Security: SECURITY DEFINER. The public HTTP endpoint validates HMAC before calling.
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
  _version_code int;
BEGIN
  -- derive a monotonically increasing integer from the version's last segment
  BEGIN
    _version_code := (regexp_replace(_version, '^.*\.', ''))::int;
  EXCEPTION WHEN others THEN
    _version_code := EXTRACT(EPOCH FROM now())::int;
  END;

  SELECT * INTO _existing FROM public.app_updates
   WHERE is_active = true
   ORDER BY version_code DESC LIMIT 1;

  IF _existing.id IS NOT NULL AND _existing.web_bundle_version = _version THEN
    -- idempotent: same version already active
    UPDATE public.app_updates SET web_bundle_url = _url WHERE id = _existing.id
      RETURNING * INTO _row;
    RETURN _row;
  END IF;

  -- deactivate all currently active rows
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
    _url,
    true,
    _url, _version,
    _existing.web_bundle_url, _existing.web_bundle_version
  ) RETURNING * INTO _row;

  RETURN _row;
END;
$$;

-- Rollback: revert the active row to its previous bundle URL/version.
CREATE OR REPLACE FUNCTION public.ota_rollback() RETURNS public.app_updates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.app_updates;
BEGIN
  SELECT * INTO _row FROM public.app_updates
   WHERE is_active = true ORDER BY version_code DESC LIMIT 1;
  IF _row.id IS NULL OR _row.previous_web_bundle_url IS NULL THEN
    RAISE EXCEPTION 'لا يوجد إصدار سابق للرجوع إليه';
  END IF;
  UPDATE public.app_updates
     SET web_bundle_url = _row.previous_web_bundle_url,
         web_bundle_version = _row.previous_web_bundle_version,
         file_url = _row.previous_web_bundle_url,
         version = _row.previous_web_bundle_version,
         previous_web_bundle_url = NULL,
         previous_web_bundle_version = NULL,
         update_message = 'تم الرجوع إلى الإصدار السابق'
   WHERE id = _row.id
   RETURNING * INTO _row;
  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.ota_publish_bundle(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ota_rollback() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ota_publish_bundle(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ota_rollback() TO service_role;