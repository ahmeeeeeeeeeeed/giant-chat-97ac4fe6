WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS i FROM public.ai_personas
)
UPDATE public.ai_personas p
SET last_post_at = NOW() - INTERVAL '300 minutes' + (r.i * INTERVAL '3 minutes')
FROM ranked r WHERE p.id = r.id;

-- Trigger an immediate cycle so content appears right away
SELECT net.http_post(
  url := 'https://project--2b1e88f7-0a17-4a29-8551-9d6dac0e0821-dev.lovable.app/api/public/hooks/ai-personas-tick',
  headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXVzb2h5ZGdwdW1nYXJkYnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzE0NDcsImV4cCI6MjA5NTMwNzQ0N30.0uy2KsvLHqaO1vmfiDsNaZgiKpOynf1oQGfCcjzh4Gc"}'::jsonb,
  body := '{}'::jsonb
);