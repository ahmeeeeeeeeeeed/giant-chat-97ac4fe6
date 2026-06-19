-- Wipe AI personas + content templates so the next cron tick re-seeds with the
-- new decorated bilingual names and Arabic+English content.
DO $$
DECLARE uid uuid;
BEGIN
  FOR uid IN SELECT profile_id FROM public.ai_personas LOOP
    DELETE FROM public.ai_personas WHERE profile_id = uid;
    DELETE FROM auth.users WHERE id = uid;
  END LOOP;
END $$;

DELETE FROM public.ai_persona_templates;
DELETE FROM public.ai_persona_activity_log;

-- Kick the cron endpoint immediately to re-seed now.
SELECT net.http_post(
  url := 'https://project--2b1e88f7-0a17-4a29-8551-9d6dac0e0821.lovable.app/api/public/hooks/ai-personas-tick',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXVzb2h5ZGdwdW1nYXJkYnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzE0NDcsImV4cCI6MjA5NTMwNzQ0N30.0uy2KsvLHqaO1vmfiDsNaZgiKpOynf1oQGfCcjzh4Gc'
  ),
  body := '{}'::jsonb
);