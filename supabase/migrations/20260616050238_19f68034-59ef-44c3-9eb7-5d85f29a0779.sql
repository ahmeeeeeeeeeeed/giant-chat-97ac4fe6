ALTER TYPE public.shop_item_kind ADD VALUE IF NOT EXISTS 'avatar_frame';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_frame uuid REFERENCES public.shop_items(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.shop_equip(_item uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _kind shop_item_kind;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_inventory WHERE user_id=_uid AND item_id=_item) THEN
    RAISE EXCEPTION 'not_owned';
  END IF;
  SELECT kind INTO _kind FROM shop_items WHERE id=_item;
  IF _kind='badge' THEN UPDATE profiles SET equipped_badge=_item WHERE id=_uid;
  ELSIF _kind='name_color' THEN UPDATE profiles SET equipped_name_color=_item WHERE id=_uid;
  ELSIF _kind='chat_color' THEN UPDATE profiles SET equipped_chat_color=_item WHERE id=_uid;
  ELSIF _kind='effect' THEN UPDATE profiles SET equipped_effect=_item WHERE id=_uid;
  ELSIF _kind='avatar_frame' THEN UPDATE profiles SET equipped_frame=_item WHERE id=_uid;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.shop_unequip(_kind shop_item_kind)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;
  IF _kind='badge' THEN UPDATE profiles SET equipped_badge=NULL WHERE id=_uid;
  ELSIF _kind='name_color' THEN UPDATE profiles SET equipped_name_color=NULL WHERE id=_uid;
  ELSIF _kind='chat_color' THEN UPDATE profiles SET equipped_chat_color=NULL WHERE id=_uid;
  ELSIF _kind='effect' THEN UPDATE profiles SET equipped_effect=NULL WHERE id=_uid;
  ELSIF _kind='avatar_frame' THEN UPDATE profiles SET equipped_frame=NULL WHERE id=_uid;
  END IF;
END $$;