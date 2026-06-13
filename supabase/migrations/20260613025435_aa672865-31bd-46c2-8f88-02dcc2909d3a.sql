
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason text;

CREATE OR REPLACE FUNCTION public.admin_set_banned(_target uuid, _banned boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.profiles SET is_banned=_banned, ban_reason=CASE WHEN _banned THEN _reason ELSE NULL END WHERE id=_target;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_role(_target uuid, _role app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_target, _role) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id=_target AND role=_role;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'cannot_delete_self'; END IF;
  DELETE FROM auth.users WHERE id = _target;
END $$;

CREATE OR REPLACE FUNCTION public.admin_reset_username(_target uuid, _new_username text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _new_username IS NULL OR length(btrim(_new_username))=0 THEN RAISE EXCEPTION 'empty_username'; END IF;
  UPDATE public.profiles SET username=btrim(_new_username) WHERE id=_target;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, username text, avatar_url text, points int, country text, is_banned boolean, ban_reason text, created_at timestamptz, last_seen_at timestamptz, roles text[])
LANGUAGE sql SECURITY DEFINER SET search_path=public STABLE AS $$
  SELECT p.id, p.username, p.avatar_url, p.points, p.country, p.is_banned, p.ban_reason, p.created_at, p.last_seen_at,
    COALESCE((SELECT array_agg(r.role::text) FROM public.user_roles r WHERE r.user_id=p.id), '{}')
  FROM public.profiles p
  WHERE public.has_role(auth.uid(),'admin')
  ORDER BY p.created_at DESC;
$$;
