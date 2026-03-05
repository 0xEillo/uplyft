-- Track lifecycle email sends for idempotency, retry safety, and auditing.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.email_automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('revenuecat', 'supabase_db')),
  source_event_id TEXT NOT NULL,
  email_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'skipped')),
  resend_email_id TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_automation_events_source_event_unique
    UNIQUE (source, source_event_id, email_type)
);

CREATE INDEX IF NOT EXISTS idx_email_automation_events_user_created
  ON public.email_automation_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_automation_events_type_created
  ON public.email_automation_events(email_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_automation_events_created
  ON public.email_automation_events(created_at DESC);

ALTER TABLE public.email_automation_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    CREATE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_email_automation_events_updated_at'
  ) THEN
    CREATE TRIGGER update_email_automation_events_updated_at
      BEFORE UPDATE ON public.email_automation_events
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
