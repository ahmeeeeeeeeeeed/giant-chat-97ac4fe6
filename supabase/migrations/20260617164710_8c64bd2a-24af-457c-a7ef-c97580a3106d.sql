
CREATE TABLE public.app_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  display_name text,
  is_anonymous boolean NOT NULL DEFAULT false,
  account_kind text NOT NULL DEFAULT 'site',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_reviews TO authenticated;
GRANT ALL ON public.app_reviews TO service_role;

ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"
  ON public.app_reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert their own review"
  ON public.app_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own review"
  ON public.app_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own review"
  ON public.app_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.app_reviews_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER app_reviews_updated_at
BEFORE UPDATE ON public.app_reviews
FOR EACH ROW EXECUTE FUNCTION public.app_reviews_set_updated_at();

CREATE INDEX app_reviews_created_at_idx ON public.app_reviews (created_at DESC);
