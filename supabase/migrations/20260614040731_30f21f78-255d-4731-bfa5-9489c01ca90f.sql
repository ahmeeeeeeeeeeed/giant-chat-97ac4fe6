
-- App updates table
CREATE TABLE public.app_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  version_code integer NOT NULL,
  minimum_required_version text NOT NULL DEFAULT '1.0.0',
  minimum_required_code integer NOT NULL DEFAULT 10000,
  update_message text NOT NULL DEFAULT '',
  update_type text NOT NULL DEFAULT 'optional' CHECK (update_type IN ('force','optional')),
  file_url text NOT NULL,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_updates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_updates TO authenticated;
GRANT ALL ON public.app_updates TO service_role;

ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read active updates"
ON public.app_updates FOR SELECT
USING (true);

CREATE POLICY "admins can insert updates"
ON public.app_updates FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can update updates"
ON public.app_updates FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can delete updates"
ON public.app_updates FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_app_updates_version_code ON public.app_updates(version_code DESC);

CREATE OR REPLACE FUNCTION public.update_app_updates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_app_updates_updated_at
BEFORE UPDATE ON public.app_updates
FOR EACH ROW EXECUTE FUNCTION public.update_app_updates_updated_at();

-- Storage policies for app-updates bucket (bucket created via tool)
CREATE POLICY "public can read app-updates"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-updates');

CREATE POLICY "admins can upload app-updates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'app-updates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can update app-updates"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'app-updates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can delete app-updates"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'app-updates' AND public.has_role(auth.uid(), 'admin'));
