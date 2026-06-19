
-- 1. Add is_ai flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;

-- 2. ai_personas table
CREATE TABLE IF NOT EXISTS public.ai_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  bio text,
  avatar_url text,
  persona_type text NOT NULL DEFAULT 'friendly',
  is_active boolean NOT NULL DEFAULT true,
  post_interval_minutes int NOT NULL DEFAULT 180,
  reaction_rate numeric NOT NULL DEFAULT 0.3 CHECK (reaction_rate >= 0 AND reaction_rate <= 1),
  last_post_at timestamptz,
  last_react_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_personas TO anon, authenticated;
GRANT ALL ON public.ai_personas TO service_role;
ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can view ai_personas" ON public.ai_personas FOR SELECT USING (true);
CREATE POLICY "admins manage ai_personas" ON public.ai_personas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. ai_persona_templates
CREATE TABLE IF NOT EXISTS public.ai_persona_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_type text NOT NULL DEFAULT 'friendly',
  kind text NOT NULL CHECK (kind IN ('post','story','comment','reply')),
  content text NOT NULL,
  media_url text,
  weight int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_persona_templates TO authenticated;
GRANT ALL ON public.ai_persona_templates TO service_role;
ALTER TABLE public.ai_persona_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage templates" ON public.ai_persona_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. ai_persona_activity_log
CREATE TABLE IF NOT EXISTS public.ai_persona_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.ai_personas(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_id uuid,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_persona_activity_log TO authenticated;
GRANT ALL ON public.ai_persona_activity_log TO service_role;
ALTER TABLE public.ai_persona_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view activity log" ON public.ai_persona_activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS ai_persona_activity_log_persona_idx ON public.ai_persona_activity_log(persona_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_personas_active_idx ON public.ai_personas(is_active) WHERE is_active = true;

-- 5. updated_at trigger for ai_personas
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS ai_personas_updated_at ON public.ai_personas;
CREATE TRIGGER ai_personas_updated_at BEFORE UPDATE ON public.ai_personas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
