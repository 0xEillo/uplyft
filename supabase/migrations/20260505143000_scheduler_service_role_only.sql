-- Stop sending x-retention-secret from pg_cron. Auth is the service_role JWT only
-- (already in Vault). This removes the need to keep Edge RETENTION_SCHEDULER_SECRET
-- and vault.retention_scheduler_secret in sync.
--
-- Deploy order: deploy Edge functions (send-retention-notifications,
-- send-proactive-coach-messages) that no longer require the header, then apply this
-- migration (or cron will 401 until Edge is updated).

CREATE OR REPLACE FUNCTION public.invoke_retention_push_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url TEXT;
  service_role_key TEXT;
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

  IF RIGHT(project_url, 1) = '/' THEN
    project_url := LEFT(project_url, LENGTH(project_url) - 1);
  END IF;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || service_role_key
  );

  PERFORM net.http_post(
    url := project_url || '/functions/v1/send-retention-notifications',
    headers := request_headers,
    body := jsonb_build_object('dryRun', false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.invoke_proactive_coach_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url TEXT;
  service_role_key TEXT;
  request_headers JSONB;
BEGIN
  SELECT decrypted_secret
  INTO project_url
  FROM vault.decrypted_secrets
  WHERE name IN ('project_url', 'supabase_url')
  ORDER BY CASE name WHEN 'project_url' THEN 0 ELSE 1 END
  LIMIT 1;

  IF project_url IS NULL OR project_url = '' THEN
    RAISE EXCEPTION 'Missing vault secret: project_url (or supabase_url).';
  END IF;

  SELECT decrypted_secret
  INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name IN ('service_role_key', 'supabase_service_role_key')
  ORDER BY CASE name WHEN 'service_role_key' THEN 0 ELSE 1 END
  LIMIT 1;

  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'Missing vault secret: service_role_key (or supabase_service_role_key).';
  END IF;

  IF RIGHT(project_url, 1) = '/' THEN
    project_url := LEFT(project_url, LENGTH(project_url) - 1);
  END IF;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || service_role_key
  );

  PERFORM net.http_post(
    url := project_url || '/functions/v1/send-proactive-coach-messages',
    headers := request_headers,
    body := jsonb_build_object('dryRun', false)
  );
END;
$$;
