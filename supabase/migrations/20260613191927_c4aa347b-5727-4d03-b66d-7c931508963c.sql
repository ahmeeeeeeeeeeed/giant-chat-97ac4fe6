
CREATE OR REPLACE FUNCTION public.log_member_leave()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('app.skip_leave_log', true), '') = 'true' THEN
    RETURN OLD;
  END IF;
  -- Skip if the room is being deleted (cascade) — avoids FK violation
  IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = OLD.room_id) THEN
    RETURN OLD;
  END IF;
  INSERT INTO public.room_logs(room_id, actor_id, target_id, event)
  VALUES (OLD.room_id, OLD.user_id, OLD.user_id, 'leave');
  RETURN OLD;
END $function$;

CREATE OR REPLACE FUNCTION public.cleanup_empty_room()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = OLD.room_id) THEN
    RETURN OLD;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = OLD.room_id) THEN
    DELETE FROM public.room_messages WHERE room_id = OLD.room_id;
  END IF;
  RETURN OLD;
END $function$;
