DROP TRIGGER IF EXISTS trg_dm_check_full_delivery ON public.dm_deliveries;

CREATE OR REPLACE FUNCTION public.dm_check_full_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.direct_messages
     SET delivered_at = COALESCE(delivered_at, NEW.delivered_at, now())
   WHERE id = NEW.message_id
     AND receiver_id = NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dm_check_full_delivery
AFTER INSERT ON public.dm_deliveries
FOR EACH ROW EXECUTE FUNCTION public.dm_check_full_delivery();

CREATE OR REPLACE FUNCTION public.dm_delete_for_me(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_delete_for_all(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_conversation(_other uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 0;
END;
$$;

DROP POLICY IF EXISTS "dm delete own" ON public.direct_messages;
REVOKE DELETE ON public.direct_messages FROM authenticated;