
-- enum
DO $$ BEGIN
  CREATE TYPE public.shop_item_kind AS ENUM ('badge','name_color','chat_color','effect');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- shop items
CREATE TABLE IF NOT EXISTS public.shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.shop_item_kind NOT NULL,
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  price int NOT NULL CHECK (price >= 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_items TO anon, authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop_items_read_all" ON public.shop_items;
CREATE POLICY "shop_items_read_all" ON public.shop_items FOR SELECT USING (true);

-- inventory
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);
GRANT SELECT ON public.user_inventory TO authenticated;
GRANT ALL ON public.user_inventory TO service_role;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_read_all" ON public.user_inventory;
CREATE POLICY "inv_read_all" ON public.user_inventory FOR SELECT USING (true);

-- profile equipped slots
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_badge uuid REFERENCES public.shop_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS equipped_name_color uuid REFERENCES public.shop_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS equipped_chat_color uuid REFERENCES public.shop_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS equipped_effect uuid REFERENCES public.shop_items(id) ON DELETE SET NULL;

-- app config (admin sales handle)
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cfg_read_all" ON public.app_config;
CREATE POLICY "cfg_read_all" ON public.app_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "cfg_admin_write" ON public.app_config;
CREATE POLICY "cfg_admin_write" ON public.app_config FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_config(key,value) VALUES ('points_seller_username','admin')
ON CONFLICT (key) DO NOTHING;

-- purchase RPC
CREATE OR REPLACE FUNCTION public.shop_purchase(_item uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _price int; _uid uuid := auth.uid(); _pts int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT price INTO _price FROM shop_items WHERE id=_item;
  IF _price IS NULL THEN RAISE EXCEPTION 'item_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM user_inventory WHERE user_id=_uid AND item_id=_item) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;
  SELECT points INTO _pts FROM profiles WHERE id=_uid;
  IF COALESCE(_pts,0) < _price THEN RAISE EXCEPTION 'insufficient_points'; END IF;
  UPDATE profiles SET points = points - _price WHERE id=_uid;
  INSERT INTO user_inventory(user_id,item_id) VALUES (_uid,_item);
END $$;

CREATE OR REPLACE FUNCTION public.shop_equip(_item uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _kind shop_item_kind; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT kind INTO _kind FROM shop_items WHERE id=_item;
  IF _kind IS NULL THEN RAISE EXCEPTION 'item_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_inventory WHERE user_id=_uid AND item_id=_item) THEN
    RAISE EXCEPTION 'not_owned';
  END IF;
  IF _kind='badge' THEN UPDATE profiles SET equipped_badge=_item WHERE id=_uid;
  ELSIF _kind='name_color' THEN UPDATE profiles SET equipped_name_color=_item WHERE id=_uid;
  ELSIF _kind='chat_color' THEN UPDATE profiles SET equipped_chat_color=_item WHERE id=_uid;
  ELSIF _kind='effect' THEN UPDATE profiles SET equipped_effect=_item WHERE id=_uid;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.shop_unequip(_kind shop_item_kind)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _kind='badge' THEN UPDATE profiles SET equipped_badge=NULL WHERE id=_uid;
  ELSIF _kind='name_color' THEN UPDATE profiles SET equipped_name_color=NULL WHERE id=_uid;
  ELSIF _kind='chat_color' THEN UPDATE profiles SET equipped_chat_color=NULL WHERE id=_uid;
  ELSIF _kind='effect' THEN UPDATE profiles SET equipped_effect=NULL WHERE id=_uid;
  END IF;
END $$;

-- seed items
INSERT INTO public.shop_items (kind, code, name_ar, price, payload, sort_order) VALUES
  ('badge','vip_gold','VIP ذهبي', 5000, '{"color":"#F5C518","icon":"crown"}'::jsonb, 1),
  ('badge','vip_diamond','VIP ماسي', 12000, '{"color":"#60A5FA","icon":"gem"}'::jsonb, 2),
  ('badge','verified','موثّق', 3000, '{"color":"#22C55E","icon":"check"}'::jsonb, 3),
  ('badge','fire','نار', 1500, '{"color":"#EF4444","icon":"flame"}'::jsonb, 4),
  ('badge','star','نجم', 2000, '{"color":"#A78BFA","icon":"star"}'::jsonb, 5),
  ('name_color','name_red','اسم أحمر', 1000, '{"color":"#EF4444"}'::jsonb, 10),
  ('name_color','name_gold','اسم ذهبي', 2500, '{"color":"#F59E0B"}'::jsonb, 11),
  ('name_color','name_purple','اسم بنفسجي', 1500, '{"color":"#A855F7"}'::jsonb, 12),
  ('name_color','name_cyan','اسم سماوي', 1200, '{"color":"#06B6D4"}'::jsonb, 13),
  ('name_color','name_pink','اسم وردي', 1500, '{"color":"#EC4899"}'::jsonb, 14),
  ('chat_color','chat_red','خط أحمر', 800, '{"color":"#EF4444"}'::jsonb, 20),
  ('chat_color','chat_blue','خط أزرق', 800, '{"color":"#3B82F6"}'::jsonb, 21),
  ('chat_color','chat_green','خط أخضر', 800, '{"color":"#22C55E"}'::jsonb, 22),
  ('chat_color','chat_gold','خط ذهبي', 1800, '{"color":"#F59E0B"}'::jsonb, 23),
  ('chat_color','chat_purple','خط بنفسجي', 1200, '{"color":"#A855F7"}'::jsonb, 24),
  ('effect','fx_hearts','قلوب طائرة', 2000, '{"emoji":"❤️"}'::jsonb, 30),
  ('effect','fx_stars','نجوم متلألئة', 2500, '{"emoji":"⭐"}'::jsonb, 31),
  ('effect','fx_fire','شعلة نار', 3000, '{"emoji":"🔥"}'::jsonb, 32),
  ('effect','fx_flowers','ورود', 2000, '{"emoji":"🌹"}'::jsonb, 33),
  ('effect','fx_crown','تاج ملكي', 5000, '{"emoji":"👑"}'::jsonb, 34),
  ('effect','fx_money','أموال', 3500, '{"emoji":"💵"}'::jsonb, 35)
ON CONFLICT (code) DO NOTHING;
