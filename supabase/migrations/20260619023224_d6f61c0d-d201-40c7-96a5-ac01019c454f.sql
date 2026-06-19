-- Redistribute AI personas' last_post_at across the 5h cycle with varied gaps (30m/1h/2h/3h)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.ai_personas
  WHERE is_active = true
),
phased AS (
  SELECT id,
    -- cumulative phase modulo 300 minutes using a deterministic pseudo-random gap
    (SUM((ARRAY[30,60,120,180])[1 + ((rn * 7) % 4)]) OVER (ORDER BY rn)) % 300 AS phase_min
  FROM ordered
)
UPDATE public.ai_personas p
SET last_post_at = NOW() - ((300 - phased.phase_min) || ' minutes')::interval,
    post_interval_minutes = 300
FROM phased
WHERE p.id = phased.id;