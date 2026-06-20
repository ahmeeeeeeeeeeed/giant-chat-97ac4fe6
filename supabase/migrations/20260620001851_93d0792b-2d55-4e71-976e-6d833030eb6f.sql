UPDATE public.direct_messages
SET deleted_for = ARRAY[]::uuid[]
WHERE array_length(deleted_for, 1) IS NOT NULL;

DROP POLICY IF EXISTS "dm read own" ON public.direct_messages;
CREATE POLICY "dm read own" ON public.direct_messages
FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

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

REVOKE DELETE ON public.direct_messages FROM authenticated;