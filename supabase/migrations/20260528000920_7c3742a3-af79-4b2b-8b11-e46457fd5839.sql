
-- Points
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 100;

-- Direct messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm read own" ON public.direct_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "dm send" ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "dm delete own" ON public.direct_messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_pair ON public.direct_messages(sender_id, receiver_id, created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Game tables
CREATE TABLE IF NOT EXISTS public.game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'open',
  secret integer NOT NULL DEFAULT (floor(random()*100)+1)::int,
  started_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL DEFAULT (now() + interval '45 seconds'),
  ended_at timestamptz,
  winner_id uuid,
  winner_name text,
  winner_value integer
);
CREATE TABLE IF NOT EXISTS public.game_seats (
  round_id uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  seat_idx integer NOT NULL CHECK (seat_idx BETWEEN 0 AND 3),
  user_id uuid,
  ai_name text,
  PRIMARY KEY (round_id, seat_idx)
);
CREATE TABLE IF NOT EXISTS public.game_guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  seat_idx integer NOT NULL,
  user_id uuid,
  ai_name text,
  display_name text NOT NULL,
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.game_waitlist (
  user_id uuid PRIMARY KEY,
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.game_system_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_key text NOT NULL,
  params jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_rounds, public.game_seats, public.game_guesses, public.game_waitlist, public.game_system_messages TO authenticated;
GRANT ALL ON public.game_rounds, public.game_seats, public.game_guesses, public.game_waitlist, public.game_system_messages TO service_role;

ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_system_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "g read rounds" ON public.game_rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "g read seats" ON public.game_seats FOR SELECT TO authenticated USING (true);
CREATE POLICY "g read guesses" ON public.game_guesses FOR SELECT TO authenticated USING (true);
CREATE POLICY "g read waitlist" ON public.game_waitlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "g read sys" ON public.game_system_messages FOR SELECT TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_seats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_waitlist;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_system_messages;

-- Functions
CREATE OR REPLACE FUNCTION public.game_fill_ai(_rid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i int; ai_names text[] := ARRAY['BotZero','BotOne','BotTwo','BotThree'];
BEGIN
  FOR i IN 0..3 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.game_seats WHERE round_id=_rid AND seat_idx=i) THEN
      INSERT INTO public.game_seats(round_id, seat_idx, ai_name)
      VALUES (_rid, i, ai_names[i+1]);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.game_ensure_round()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  SELECT id INTO rid FROM public.game_rounds WHERE status='open' ORDER BY started_at DESC LIMIT 1;
  IF rid IS NULL THEN
    INSERT INTO public.game_rounds DEFAULT VALUES RETURNING id INTO rid;
    INSERT INTO public.game_system_messages(text_key) VALUES ('game.round_started');
  END IF;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.game_maybe_end(_rid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.game_rounds%ROWTYPE; seat_count int; guess_count int;
  ai_seat record; winner record; new_rid uuid; promoted uuid; i int;
BEGIN
  SELECT * INTO r FROM public.game_rounds WHERE id=_rid;
  IF r.status <> 'open' THEN RETURN; END IF;
  SELECT count(*) INTO seat_count FROM public.game_seats WHERE round_id=_rid;
  -- if deadline passed, fill AI guesses
  IF now() >= r.deadline_at THEN
    FOR ai_seat IN SELECT seat_idx, ai_name FROM public.game_seats WHERE round_id=_rid AND ai_name IS NOT NULL LOOP
      IF NOT EXISTS (SELECT 1 FROM public.game_guesses WHERE round_id=_rid AND seat_idx=ai_seat.seat_idx) THEN
        INSERT INTO public.game_guesses(round_id, seat_idx, ai_name, display_name, value)
        VALUES (_rid, ai_seat.seat_idx, ai_seat.ai_name, ai_seat.ai_name, (floor(random()*100)+1)::int);
      END IF;
    END LOOP;
  END IF;
  SELECT count(*) INTO guess_count FROM public.game_guesses WHERE round_id=_rid;
  IF guess_count < seat_count AND now() < r.deadline_at THEN RETURN; END IF;
  -- all guessed or deadline: also ensure AI guessed even if early end
  FOR ai_seat IN SELECT seat_idx, ai_name FROM public.game_seats WHERE round_id=_rid AND ai_name IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.game_guesses WHERE round_id=_rid AND seat_idx=ai_seat.seat_idx) THEN
      INSERT INTO public.game_guesses(round_id, seat_idx, ai_name, display_name, value)
      VALUES (_rid, ai_seat.seat_idx, ai_seat.ai_name, ai_seat.ai_name, (floor(random()*100)+1)::int);
    END IF;
  END LOOP;
  SELECT g.* INTO winner FROM public.game_guesses g WHERE g.round_id=_rid
    ORDER BY abs(g.value - r.secret) ASC, g.created_at ASC LIMIT 1;
  UPDATE public.game_rounds SET status='finished', ended_at=now(),
    winner_id=winner.user_id, winner_name=winner.display_name, winner_value=winner.value
    WHERE id=_rid;
  IF winner.user_id IS NOT NULL THEN
    UPDATE public.profiles SET points = points + 40 WHERE id=winner.user_id;
  END IF;
  INSERT INTO public.game_system_messages(text_key, params)
    VALUES ('game.winner', jsonb_build_object('name', winner.display_name, 'secret', r.secret, 'guess', winner.value));
  -- next round
  INSERT INTO public.game_rounds DEFAULT VALUES RETURNING id INTO new_rid;
  INSERT INTO public.game_system_messages(text_key) VALUES ('game.round_started');
  FOR i IN 0..3 LOOP
    SELECT user_id INTO promoted FROM public.game_waitlist ORDER BY joined_at LIMIT 1;
    EXIT WHEN promoted IS NULL;
    DELETE FROM public.game_waitlist WHERE user_id=promoted;
    IF (SELECT points FROM public.profiles WHERE id=promoted) >= 10 THEN
      UPDATE public.profiles SET points = points - 10 WHERE id=promoted;
      INSERT INTO public.game_seats(round_id, seat_idx, user_id)
        VALUES (new_rid, i, promoted);
      INSERT INTO public.game_system_messages(text_key, params)
        VALUES ('game.replaced_ai', jsonb_build_object('name', (SELECT username FROM public.profiles WHERE id=promoted)));
    END IF;
  END LOOP;
  PERFORM public.game_fill_ai(new_rid);
END $$;

CREATE OR REPLACE FUNCTION public.game_join()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rid uuid; pts int; uname text; free_seat int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT points, username INTO pts, uname FROM public.profiles WHERE id=uid;
  IF pts IS NULL OR pts < 10 THEN RAISE EXCEPTION 'insufficient_points'; END IF;
  rid := public.game_ensure_round();
  IF EXISTS (SELECT 1 FROM public.game_seats WHERE round_id=rid AND user_id=uid) THEN
    RETURN jsonb_build_object('status','already_seated','round_id',rid);
  END IF;
  SELECT s INTO free_seat FROM generate_series(0,3) s
    WHERE s NOT IN (SELECT seat_idx FROM public.game_seats WHERE round_id=rid AND user_id IS NOT NULL)
    ORDER BY s LIMIT 1;
  IF free_seat IS NULL THEN
    INSERT INTO public.game_waitlist(user_id) VALUES (uid) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status','waitlisted');
  END IF;
  UPDATE public.profiles SET points = points - 10 WHERE id=uid;
  -- replace AI seat if any, else insert new
  DELETE FROM public.game_seats WHERE round_id=rid AND seat_idx=free_seat;
  INSERT INTO public.game_seats(round_id, seat_idx, user_id) VALUES (rid, free_seat, uid);
  INSERT INTO public.game_system_messages(text_key, params)
    VALUES ('game.user_joined', jsonb_build_object('name', uname));
  PERFORM public.game_fill_ai(rid);
  RETURN jsonb_build_object('status','seated','round_id',rid);
END $$;

CREATE OR REPLACE FUNCTION public.game_guess(_value integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rid uuid; sidx int; uname text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _value < 1 OR _value > 100 THEN RAISE EXCEPTION 'invalid value'; END IF;
  SELECT id INTO rid FROM public.game_rounds WHERE status='open' ORDER BY started_at DESC LIMIT 1;
  IF rid IS NULL THEN RAISE EXCEPTION 'no round'; END IF;
  SELECT seat_idx INTO sidx FROM public.game_seats WHERE round_id=rid AND user_id=uid;
  IF sidx IS NULL THEN RAISE EXCEPTION 'not seated'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_guesses WHERE round_id=rid AND user_id=uid) THEN
    RAISE EXCEPTION 'already guessed';
  END IF;
  SELECT username INTO uname FROM public.profiles WHERE id=uid;
  INSERT INTO public.game_guesses(round_id, seat_idx, user_id, display_name, value)
    VALUES (rid, sidx, uid, uname, _value);
  INSERT INTO public.game_system_messages(text_key, params)
    VALUES ('game.user_guessed', jsonb_build_object('name', uname, 'value', _value));
  PERFORM public.game_maybe_end(rid);
END $$;

CREATE OR REPLACE FUNCTION public.game_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  SELECT id INTO rid FROM public.game_rounds WHERE status='open' AND now() >= deadline_at ORDER BY started_at LIMIT 1;
  IF rid IS NOT NULL THEN PERFORM public.game_maybe_end(rid); END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.game_join() TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_guess(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_tick() TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_ensure_round() TO authenticated;
