-- ============ activity_logs table ============
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('auth','account','purchase','points','gift','security','system')),
  action text NOT NULL,
  old_value text,
  new_value text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user','admin','system')),
  points_before integer,
  points_after integer,
  points_delta integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own activity" ON public.activity_logs;
CREATE POLICY "users read own activity" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- No INSERT/UPDATE/DELETE policies = no one can modify from client (only SECURITY DEFINER functions/triggers).

CREATE INDEX IF NOT EXISTS idx_activity_user_time ON public.activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_category ON public.activity_logs(category);

-- ============ client-callable: log auth events / password changes / etc ============
CREATE OR REPLACE FUNCTION public.log_activity(
  _category text,
  _action text,
  _old_value text DEFAULT NULL,
  _new_value text DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  -- Restrict the categories the client may write directly
  IF _category NOT IN ('auth','security','account') THEN
    RAISE EXCEPTION 'forbidden_category';
  END IF;
  INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, meta, ip, user_agent, source)
  VALUES (_uid, _category, _action, _old_value, _new_value, COALESCE(_meta,'{}'::jsonb), _ip, _user_agent, 'user');
END $$;

-- ============ get my activity ============
CREATE OR REPLACE FUNCTION public.get_my_activity(_limit int DEFAULT 50, _category text DEFAULT NULL)
RETURNS SETOF public.activity_logs
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.activity_logs
  WHERE user_id = auth.uid()
    AND (_category IS NULL OR category = _category)
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit,50), 500));
$$;

-- ============ admin: get any user activity ============
CREATE OR REPLACE FUNCTION public.admin_get_activity(_target uuid, _limit int DEFAULT 100, _category text DEFAULT NULL)
RETURNS SETOF public.activity_logs
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
    SELECT * FROM public.activity_logs
    WHERE user_id = _target
      AND (_category IS NULL OR category = _category)
    ORDER BY created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(_limit,100), 1000));
END $$;

-- ============ profile changes trigger ============
CREATE OR REPLACE FUNCTION public.tg_log_profile_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _src text := 'user'; _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN _src := 'system';
  ELSIF _actor <> NEW.id THEN _src := 'admin';
  END IF;

  IF NEW.username IS DISTINCT FROM OLD.username THEN
    INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, source)
    VALUES (NEW.id, 'account', 'username_changed', OLD.username, NEW.username, _src);
  END IF;
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, source)
    VALUES (NEW.id, 'account', 'avatar_changed', OLD.avatar_url, NEW.avatar_url, _src);
  END IF;
  IF NEW.cover_url IS DISTINCT FROM OLD.cover_url THEN
    INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, source)
    VALUES (NEW.id, 'account', 'cover_changed', OLD.cover_url, NEW.cover_url, _src);
  END IF;
  IF COALESCE(NEW.is_premium,false) IS DISTINCT FROM COALESCE(OLD.is_premium,false) THEN
    INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, source)
    VALUES (NEW.id, 'account',
      CASE WHEN NEW.is_premium THEN 'upgraded_premium' ELSE 'downgraded_premium' END,
      COALESCE(OLD.is_premium,false)::text, COALESCE(NEW.is_premium,false)::text, _src);
  END IF;
  IF NEW.equipped_badge IS DISTINCT FROM OLD.equipped_badge THEN
    INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, source)
    VALUES (NEW.id, 'account', CASE WHEN NEW.equipped_badge IS NULL THEN 'badge_unequipped' ELSE 'badge_equipped' END,
            OLD.equipped_badge::text, NEW.equipped_badge::text, _src);
  END IF;
  IF NEW.equipped_name_color IS DISTINCT FROM OLD.equipped_name_color THEN
    INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, source)
    VALUES (NEW.id, 'account', CASE WHEN NEW.equipped_name_color IS NULL THEN 'name_color_unequipped' ELSE 'name_color_equipped' END,
            OLD.equipped_name_color::text, NEW.equipped_name_color::text, _src);
  END IF;
  IF NEW.equipped_chat_color IS DISTINCT FROM OLD.equipped_chat_color THEN
    INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, source)
    VALUES (NEW.id, 'account', CASE WHEN NEW.equipped_chat_color IS NULL THEN 'chat_color_unequipped' ELSE 'chat_color_equipped' END,
            OLD.equipped_chat_color::text, NEW.equipped_chat_color::text, _src);
  END IF;
  IF NEW.equipped_effect IS DISTINCT FROM OLD.equipped_effect THEN
    INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, source)
    VALUES (NEW.id, 'account', CASE WHEN NEW.equipped_effect IS NULL THEN 'effect_unequipped' ELSE 'effect_equipped' END,
            OLD.equipped_effect::text, NEW.equipped_effect::text, _src);
  END IF;
  IF NEW.equipped_frame IS DISTINCT FROM OLD.equipped_frame THEN
    INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, source)
    VALUES (NEW.id, 'account', CASE WHEN NEW.equipped_frame IS NULL THEN 'frame_unequipped' ELSE 'frame_equipped' END,
            OLD.equipped_frame::text, NEW.equipped_frame::text, _src);
  END IF;
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
    INSERT INTO public.activity_logs(user_id, category, action, old_value, new_value, source, meta)
    VALUES (NEW.id, 'security', CASE WHEN NEW.is_banned THEN 'banned' ELSE 'unbanned' END,
            COALESCE(OLD.is_banned,false)::text, COALESCE(NEW.is_banned,false)::text, 'admin',
            jsonb_build_object('reason', NEW.ban_reason));
  END IF;
  IF NEW.points IS DISTINCT FROM OLD.points THEN
    INSERT INTO public.activity_logs(user_id, category, action, points_before, points_after, points_delta, source)
    VALUES (NEW.id, 'points',
      CASE WHEN COALESCE(NEW.points,0) > COALESCE(OLD.points,0) THEN 'points_credit' ELSE 'points_debit' END,
      OLD.points, NEW.points, COALESCE(NEW.points,0) - COALESCE(OLD.points,0), _src);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_log_profile_changes ON public.profiles;
CREATE TRIGGER tg_log_profile_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_log_profile_changes();

-- ============ purchase trigger (user_inventory insert) ============
CREATE OR REPLACE FUNCTION public.tg_log_purchase()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _item record;
BEGIN
  SELECT name_ar, price, kind, code INTO _item FROM public.shop_items WHERE id = NEW.item_id;
  INSERT INTO public.activity_logs(user_id, category, action, new_value, source, meta)
  VALUES (NEW.user_id, 'purchase', 'item_purchased',
          COALESCE(_item.name_ar, _item.code), 'user',
          jsonb_build_object('item_id', NEW.item_id, 'kind', _item.kind, 'code', _item.code, 'price', _item.price));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_log_purchase ON public.user_inventory;
CREATE TRIGGER tg_log_purchase
  AFTER INSERT ON public.user_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_log_purchase();

-- ============ gift trigger ============
CREATE OR REPLACE FUNCTION public.tg_log_gift()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _g record; _sname text; _rname text;
BEGIN
  SELECT name, emoji INTO _g FROM public.gifts_catalog WHERE id = NEW.gift_id;
  SELECT username INTO _sname FROM public.profiles WHERE id = NEW.sender_id;
  SELECT username INTO _rname FROM public.profiles WHERE id = NEW.receiver_id;
  -- sender entry
  INSERT INTO public.activity_logs(user_id, category, action, new_value, source, meta)
  VALUES (NEW.sender_id, 'gift', 'gift_sent', _g.name, 'user',
          jsonb_build_object('gift_id', NEW.gift_id, 'emoji', _g.emoji, 'cost', NEW.cost_points,
                             'receiver_id', NEW.receiver_id, 'receiver_name', _rname, 'scope', NEW.scope));
  -- receiver entry
  INSERT INTO public.activity_logs(user_id, category, action, new_value, source, meta)
  VALUES (NEW.receiver_id, 'gift', 'gift_received', _g.name, 'system',
          jsonb_build_object('gift_id', NEW.gift_id, 'emoji', _g.emoji, 'cost', NEW.cost_points,
                             'sender_id', NEW.sender_id, 'sender_name', _sname, 'scope', NEW.scope));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_log_gift ON public.gift_transactions;
CREATE TRIGGER tg_log_gift
  AFTER INSERT ON public.gift_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_log_gift();