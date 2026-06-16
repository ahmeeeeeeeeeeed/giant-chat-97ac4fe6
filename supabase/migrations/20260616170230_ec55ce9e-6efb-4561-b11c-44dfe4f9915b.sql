
ALTER TABLE public.app_updates
  ADD COLUMN IF NOT EXISTS web_bundle_url text,
  ADD COLUMN IF NOT EXISTS web_bundle_version text;
