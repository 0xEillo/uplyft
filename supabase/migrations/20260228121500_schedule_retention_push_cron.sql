-- Schedule hourly retention push processing in Supabase using pg_cron + pg_net.
--
-- Required Vault secrets (create in Supabase SQL editor before/after this migration):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
--   select vault.create_secret('<random-shared-secret>', 'retention_scheduler_secret');
--
-- The same retention_scheduler_secret must be set as an Edge Function env var:
--   RETENTION_SCHEDULER_SECRET

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE OR REPLACE FUNCTION public.invoke_retention_push_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url TEXT;
  service_role_key TEXT;
  retention_secret TEXT;
  request_headers JSONB;
BEGIN
  SELECT decrypted_secret
  INTO project_url
  FROM vault.decrypted_secrets
  WHERE name IN ('project_url', 'supabase_url')
  ORDER BY CASE name WHEN 'project_url' THEN 0 ELSE 1 END
  LIMIT 1;

  IF project_url IS NULL OR project_url = '' THEN
    RAISE EXCEPTION
      'Missing vault secret: project_url (or supabase_url).';
  END IF;

  SELECT decrypted_secret
  INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name IN ('service_role_key', 'supabase_service_role_key')
  ORDER BY CASE name WHEN 'service_role_key' THEN 0 ELSE 1 END
  LIMIT 1;

  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION
      'Missing vault secret: service_role_key (or supabase_service_role_key).';
  END IF;

  SELECT decrypted_secret
  INTO retention_secret
  FROM vault.decrypted_secrets
  WHERE name = 'retention_scheduler_secret'
  LIMIT 1;

  IF retention_secret IS NULL OR retention_secret = '' THEN
    RAISE EXCEPTION
      'Missing vault secret: retention_scheduler_secret.';
  END IF;

  -- Normalize trailing slash to avoid double-slash URLs.
  IF RIGHT(project_url, 1) = '/' THEN
    project_url := LEFT(project_url, LENGTH(project_url) - 1);
  END IF;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || service_role_key,
    'x-retention-secret', retention_secret
  );

  PERFORM net.http_post(
    url := project_url || '/functions/v1/send-retention-notifications',
    headers := request_headers,
    body := jsonb_build_object('dryRun', false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_retention_push_scheduler() FROM PUBLIC;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'retention-notifications-hourly'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END;
$$;

SELECT cron.schedule(
  'retention-notifications-hourly',
  '5 * * * *',
  $$SELECT public.invoke_retention_push_scheduler();$$
);
