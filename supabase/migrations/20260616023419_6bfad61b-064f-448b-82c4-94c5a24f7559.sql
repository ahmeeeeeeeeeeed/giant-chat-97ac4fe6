
-- Phase 3: Profile entry effects + gender-targeted catalog

ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS gender_target text; -- NULL=all, 'male', 'female'

ALTER TABLE public.shop_items
  DROP CONSTRAINT IF EXISTS shop_items_gender_target_chk;
ALTER TABLE public.shop_items
  ADD CONSTRAINT shop_items_gender_target_chk
  CHECK (gender_target IS NULL OR gender_target IN ('male','female'));

-- Reasonable pricing + gender targeting for existing entry effects
UPDATE public.shop_items SET price = 1500, gender_target = 'female' WHERE code = 'entry_princess';
UPDATE public.shop_items SET price = 1500, gender_target = 'male'   WHERE code = 'entry_knight';
UPDATE public.shop_items SET price = 2500, gender_target = 'male'   WHERE code = 'entry_dragon';
UPDATE public.shop_items SET price = 1200, gender_target = NULL     WHERE code = 'entry_magic';
UPDATE public.shop_items SET price = 1000, gender_target = NULL     WHERE code = 'entry_mascot';
UPDATE public.shop_items SET price = 1800, gender_target = NULL     WHERE code = 'entry_portal';

-- RPC: equip an owned effect as the profile entry effect
CREATE OR REPLACE FUNCTION public.set_my_entry_effect(_item uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _kind text; _code text; _gender_target text; _my_gender text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _item IS NULL THEN
    UPDATE public.profiles SET equipped_effect = NULL WHERE id = _uid;
    RETURN;
  END IF;
  SELECT kind::text, code, gender_target INTO _kind, _code, _gender_target
    FROM public.shop_items WHERE id = _item;
  IF _kind IS NULL THEN RAISE EXCEPTION 'item_not_found'; END IF;
  IF _kind <> 'effect' THEN RAISE EXCEPTION 'not_an_effect'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = _uid AND item_id = _item) THEN
    RAISE EXCEPTION 'not_owned';
  END IF;
  IF _gender_target IS NOT NULL THEN
    SELECT gender INTO _my_gender FROM public.profiles WHERE id = _uid;
    IF _my_gender IS NULL OR _my_gender <> _gender_target THEN
      RAISE EXCEPTION 'gender_restricted';
    END IF;
  END IF;
  UPDATE public.profiles SET equipped_effect = _item WHERE id = _uid;
END $$;
