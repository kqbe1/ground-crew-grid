
SELECT cron.schedule(
  'security-monitor-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://obvvrvcvijyvnnfdcrpg.supabase.co/functions/v1/security-monitor',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idnZydmN2aWp5dm5uZmRjcnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDc3MzMsImV4cCI6MjA4NzA4MzczM30.qf-6txCJRckIe90_wtXcoW5-D_PQfhenUTk1vQWMlpo"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
