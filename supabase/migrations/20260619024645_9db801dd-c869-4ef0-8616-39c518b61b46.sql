
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM public.ai_personas
  WHERE is_active = true
)
UPDATE public.ai_personas p
SET post_interval_minutes = CASE ((r.rn - 1) % 5)
    WHEN 0 THEN 60
    WHEN 1 THEN 120
    WHEN 2 THEN 180
    WHEN 3 THEN 240
    ELSE 300
  END,
  last_post_at = now() - interval '10 hours' - ((r.rn * 7) || ' minutes')::interval
FROM ranked r
WHERE p.id = r.id;

SELECT net.http_post(
  url := 'https://project--2b1e88f7-0a17-4a29-8551-9d6dac0e0821.lovable.app/api/public/hooks/ai-personas-tick',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXVzb2h5ZGdwdW1nYXJkYnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzE0NDcsImV4cCI6MjA5NTMwNzQ0N30.0uy2KsvLHqaO1vmfiDsNaZgiKpOynf1oQGfCcjzh4Gc'
  ),
  body := '{}'::jsonb
);
