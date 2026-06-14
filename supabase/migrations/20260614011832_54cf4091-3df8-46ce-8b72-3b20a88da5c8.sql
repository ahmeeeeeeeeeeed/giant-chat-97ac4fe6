REVOKE SELECT (password_hash) ON public.rooms FROM authenticated;
REVOKE SELECT (password_hash) ON public.rooms FROM anon;