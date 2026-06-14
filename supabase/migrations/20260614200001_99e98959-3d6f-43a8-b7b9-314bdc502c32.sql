
REVOKE SELECT (secret) ON public.game_rounds FROM authenticated, anon;

REVOKE SELECT (auth_email, recovery_email) ON public.profiles FROM authenticated, anon;
