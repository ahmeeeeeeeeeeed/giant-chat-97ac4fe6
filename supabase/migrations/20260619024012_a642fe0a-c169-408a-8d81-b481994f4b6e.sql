-- Force all 20 personas to be due NOW: set last_post_at far in the past
-- Then re-stagger AFTER this batch runs (handled by next cycle via existing jitter logic)
UPDATE public.ai_personas
SET last_post_at = now() - interval '10 hours'
WHERE is_active = true;

-- Trigger an immediate cycle so the first batch publishes right away
SELECT net.http_post(
  url := 'https://project--2b1e88f7-0a17-4a29-8551-9d6dac0e0821.lovable.app/api/public/hooks/ai-personas-tick',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXVzb2h5ZGdwdW1nYXJkYnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzE0NDcsImV4cCI6MjA5NTMwNzQ0N30.0uy2KsvLHqaO1vmfiDsNaZgiKpOynf1oQGfCcjzh4Gc'
  ),
  body := '{}'::jsonb
);

-- Second trigger 30s later for ambient reactions to settle
SELECT pg_sleep(2);
SELECT net.http_post(
  url := 'https://project--2b1e88f7-0a17-4a29-8551-9d6dac0e0821-dev.lovable.app/api/public/hooks/ai-personas-tick',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXVzb2h5ZGdwdW1nYXJkYnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzE0NDcsImV4cCI6MjA5NTMwNzQ0N30.0uy2KsvLHqaO1vmfiDsNaZgiKpOynf1oQGfCcjzh4Gc'
  ),
  body := '{}'::jsonb
);