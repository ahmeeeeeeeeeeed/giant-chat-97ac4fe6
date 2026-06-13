
-- Community feature: posts, reactions, comments, reports + admin controls
CREATE TYPE public.community_post_kind AS ENUM ('text','image','video','mixed');
CREATE TYPE public.community_reaction AS ENUM ('like','love','haha','wow','sad','angry');
CREATE TYPE public.community_report_status AS ENUM ('open','reviewed','dismissed');

-- Posts
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  media_url text,
  media_type text,
  kind public.community_post_kind NOT NULL DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts read all auth" ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts insert own" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts update own" ON public.community_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts delete own or admin" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update any post" ON public.community_posts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Reactions
CREATE TABLE public.community_reactions (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction public.community_reaction NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_reactions TO authenticated;
GRANT ALL ON public.community_reactions TO service_role;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions read all" ON public.community_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions write own" ON public.community_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions update own" ON public.community_reactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions delete own" ON public.community_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comments
CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT ALL ON public.community_comments TO service_role;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments read all" ON public.community_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments insert own" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments delete own or admin or post owner" ON public.community_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin')
         OR EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

-- Reports
CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  status public.community_report_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_reports TO authenticated;
GRANT ALL ON public.community_reports TO service_role;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports insert own" ON public.community_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports read own or admin" ON public.community_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "reports admin update" ON public.community_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "reports admin delete" ON public.community_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.community_posts_touch() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); IF NEW.content IS DISTINCT FROM OLD.content OR NEW.media_url IS DISTINCT FROM OLD.media_url THEN NEW.edited = true; END IF; RETURN NEW; END $$;
CREATE TRIGGER community_posts_touch BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.community_posts_touch();

-- Admin: force delete any post
CREATE OR REPLACE FUNCTION public.admin_delete_post(_post uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.community_posts WHERE id = _post;
END $$;

-- Storage policies for 'community' bucket
CREATE POLICY "community read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community');
CREATE POLICY "community upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "community delete own or admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
