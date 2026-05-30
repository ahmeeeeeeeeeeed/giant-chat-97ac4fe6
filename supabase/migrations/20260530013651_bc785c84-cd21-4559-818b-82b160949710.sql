
-- Change default secret to 1..5 for future rounds
ALTER TABLE public.game_rounds
  ALTER COLUMN secret SET DEFAULT ((floor((random() * 5)) + 1))::integer;

-- Update current open round's secret to be in 1..5 too
UPDATE public.game_rounds
  SET secret = ((floor(random() * 5)) + 1)::integer
  WHERE status = 'open';

-- Replace game_guess to validate 1..5
CREATE OR REPLACE FUNCTION public.game_guess(_value integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); rid uuid; sidx int; uname text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _value < 1 OR _value > 5 THEN RAISE EXCEPTION 'invalid value'; END IF;
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
END $function$;

-- Replace game_maybe_end so AI guesses 1..5
CREATE OR REPLACE FUNCTION public.game_maybe_end(_rid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.game_rounds%ROWTYPE; seat_count int; guess_count int;
  ai_seat record; winner record; new_rid uuid; promoted uuid; i int;
BEGIN
  SELECT * INTO r FROM public.game_rounds WHERE id=_rid;
  IF r.status <> 'open' THEN RETURN; END IF;
  SELECT count(*) INTO seat_count FROM public.game_seats WHERE round_id=_rid;
  IF now() >= r.deadline_at THEN
    FOR ai_seat IN SELECT seat_idx, ai_name FROM public.game_seats WHERE round_id=_rid AND ai_name IS NOT NULL LOOP
      IF NOT EXISTS (SELECT 1 FROM public.game_guesses WHERE round_id=_rid AND seat_idx=ai_seat.seat_idx) THEN
        INSERT INTO public.game_guesses(round_id, seat_idx, ai_name, display_name, value)
        VALUES (_rid, ai_seat.seat_idx, ai_seat.ai_name, ai_seat.ai_name, (floor(random()*5)+1)::int);
      END IF;
    END LOOP;
  END IF;
  SELECT count(*) INTO guess_count FROM public.game_guesses WHERE round_id=_rid;
  IF guess_count < seat_count AND now() < r.deadline_at THEN RETURN; END IF;
  FOR ai_seat IN SELECT seat_idx, ai_name FROM public.game_seats WHERE round_id=_rid AND ai_name IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.game_guesses WHERE round_id=_rid AND seat_idx=ai_seat.seat_idx) THEN
      INSERT INTO public.game_guesses(round_id, seat_idx, ai_name, display_name, value)
      VALUES (_rid, ai_seat.seat_idx, ai_seat.ai_name, ai_seat.ai_name, (floor(random()*5)+1)::int);
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
END $function$;
