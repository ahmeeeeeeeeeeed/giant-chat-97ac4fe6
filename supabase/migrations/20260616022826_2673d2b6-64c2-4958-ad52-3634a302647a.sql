
-- Phase 2: Gifts system

-- 1) Gifts catalog
CREATE TABLE IF NOT EXISTS public.gifts_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text,
  icon_url text,
  animation_url text,
  cost_points int NOT NULL DEFAULT 0,
  scope text NOT NULL DEFAULT 'room', -- 'room' | 'global'
  effect_type text NOT NULL DEFAULT 'overlay', -- 'overlay' | 'fullscreen' | 'fly'
  category text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gifts_catalog TO anon, authenticated;
GRANT ALL ON public.gifts_catalog TO service_role;
ALTER TABLE public.gifts_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gifts_catalog_read_all" ON public.gifts_catalog FOR SELECT USING (true);

-- 2) Gift transactions (sent log)
CREATE TABLE IF NOT EXISTS public.gift_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  gift_id uuid NOT NULL REFERENCES public.gifts_catalog(id) ON DELETE RESTRICT,
  scope text NOT NULL DEFAULT 'room',
  cost_points int NOT NULL DEFAULT 0,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gift_tx_recv_idx ON public.gift_transactions(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gift_tx_send_idx ON public.gift_transactions(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gift_tx_room_idx ON public.gift_transactions(room_id, created_at DESC);
GRANT SELECT ON public.gift_transactions TO authenticated;
GRANT ALL ON public.gift_transactions TO service_role;
ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gift_tx_visible" ON public.gift_transactions FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id
         OR (room_id IS NOT NULL AND public.is_room_member(room_id, auth.uid())));

ALTER PUBLICATION supabase_realtime ADD TABLE public.gift_transactions;

-- 3) RPC: send a gift
CREATE OR REPLACE FUNCTION public.send_gift(_receiver uuid, _gift uuid, _room uuid DEFAULT NULL, _message text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _g record;
  _pts int;
  _tx uuid;
  _sname text; _rname text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _receiver = _uid THEN RAISE EXCEPTION 'cannot_gift_self'; END IF;
  SELECT * INTO _g FROM public.gifts_catalog WHERE id = _gift AND is_active = true;
  IF _g.id IS NULL THEN RAISE EXCEPTION 'gift_not_found'; END IF;
  IF _g.scope = 'room' AND _room IS NULL THEN RAISE EXCEPTION 'room_required'; END IF;
  IF _room IS NOT NULL AND NOT public.is_room_member(_room, _uid) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  SELECT points INTO _pts FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF COALESCE(_pts,0) < _g.cost_points THEN RAISE EXCEPTION 'insufficient_points'; END IF;

  -- Charge sender, credit a small bonus to receiver (10%)
  UPDATE public.profiles SET points = points - _g.cost_points WHERE id = _uid;
  UPDATE public.profiles SET points = points + GREATEST(1, (_g.cost_points / 10)) WHERE id = _receiver;

  INSERT INTO public.gift_transactions(sender_id, receiver_id, room_id, gift_id, scope, cost_points, message)
    VALUES (_uid, _receiver, _room, _gift, _g.scope, _g.cost_points, _message)
    RETURNING id INTO _tx;

  SELECT username INTO _sname FROM public.profiles WHERE id = _uid;
  SELECT username INTO _rname FROM public.profiles WHERE id = _receiver;

  IF _room IS NOT NULL THEN
    INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
    VALUES (_room, NULL,
      '🎁 ' || COALESCE(_sname,'مستخدم') || ' أهدى ' || COALESCE(_rname,'عضو') || ' ' || COALESCE(_g.emoji,'') || ' ' || _g.name,
      'system',
      jsonb_build_object(
        'kind','gift',
        'gift_id',_g.id,
        'gift_name',_g.name,
        'emoji',_g.emoji,
        'icon_url',_g.icon_url,
        'animation_url',_g.animation_url,
        'effect_type',_g.effect_type,
        'scope',_g.scope,
        'sender_id',_uid,'sender_name',_sname,
        'receiver_id',_receiver,'receiver_name',_rname,
        'message',_message,
        'cost',_g.cost_points
      )
    );
  END IF;

  -- If global, broadcast across all active rooms
  IF _g.scope = 'global' THEN
    INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
    SELECT r.id, NULL,
      '🌍🎁 ' || COALESCE(_sname,'مستخدم') || ' أهدى ' || COALESCE(_rname,'عضو') || ' ' || COALESCE(_g.emoji,'') || ' ' || _g.name || ' (هدية عالمية)',
      'system',
      jsonb_build_object(
        'kind','gift_global',
        'gift_id',_g.id,'gift_name',_g.name,'emoji',_g.emoji,
        'icon_url',_g.icon_url,'animation_url',_g.animation_url,
        'effect_type',_g.effect_type,'scope','global',
        'sender_id',_uid,'sender_name',_sname,
        'receiver_id',_receiver,'receiver_name',_rname,
        'cost',_g.cost_points
      )
    FROM public.rooms r WHERE r.is_active = true AND (_room IS NULL OR r.id <> _room);
  END IF;

  RETURN _tx;
END $$;

-- 4) Seed gifts catalog
INSERT INTO public.gifts_catalog(name, emoji, cost_points, scope, effect_type, category, sort_order) VALUES
  ('وردة', '🌹', 10, 'room', 'fly', 'romantic', 1),
  ('قلب', '❤️', 20, 'room', 'fly', 'romantic', 2),
  ('قبلة', '😘', 30, 'room', 'fly', 'romantic', 3),
  ('دب', '🧸', 50, 'room', 'overlay', 'cute', 4),
  ('كعكة', '🎂', 80, 'room', 'overlay', 'fun', 5),
  ('ألعاب نارية', '🎆', 150, 'room', 'fullscreen', 'celebration', 6),
  ('برق', '⚡', 200, 'room', 'fullscreen', 'epic', 7),
  ('تاج', '👑', 500, 'room', 'fullscreen', 'epic', 8),
  ('أميرة', '👸', 800, 'room', 'fullscreen', 'epic', 9),
  ('سيارة', '🏎️', 1000, 'room', 'fullscreen', 'epic', 10),
  ('طائرة', '✈️', 1500, 'room', 'fullscreen', 'epic', 11),
  ('تنين', '🐉', 3000, 'global', 'fullscreen', 'legendary', 12),
  ('سفينة فضاء', '🚀', 5000, 'global', 'fullscreen', 'legendary', 13),
  ('قصر', '🏰', 8000, 'global', 'fullscreen', 'legendary', 14)
ON CONFLICT DO NOTHING;
