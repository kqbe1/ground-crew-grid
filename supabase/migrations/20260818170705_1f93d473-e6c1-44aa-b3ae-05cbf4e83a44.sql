-- Company email configuration
CREATE TABLE public.company_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  reply_to_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_email_settings TO authenticated;
GRANT ALL ON public.company_email_settings TO service_role;
ALTER TABLE public.company_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_email_settings_select" ON public.company_email_settings
  FOR SELECT TO authenticated
  USING (private.is_super_admin() OR company_id = private.get_my_company_id());
CREATE POLICY "company_email_settings_insert" ON public.company_email_settings
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin() OR (private.is_admin_or_bureau() AND company_id = private.get_my_company_id()));
CREATE POLICY "company_email_settings_update" ON public.company_email_settings
  FOR UPDATE TO authenticated
  USING (private.is_super_admin() OR (private.is_admin_or_bureau() AND company_id = private.get_my_company_id()))
  WITH CHECK (private.is_super_admin() OR (private.is_admin_or_bureau() AND company_id = private.get_my_company_id()));
CREATE POLICY "company_email_settings_delete" ON public.company_email_settings
  FOR DELETE TO authenticated
  USING (private.is_super_admin());

CREATE TRIGGER update_company_email_settings_updated_at
  BEFORE UPDATE ON public.company_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_company_id_company_email_settings
  BEFORE INSERT ON public.company_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

-- Email logs
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  sender_email text,
  reply_to_email text,
  subject text,
  email_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  resend_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX idx_email_logs_company ON public.email_logs (company_id, created_at DESC);

GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_select" ON public.email_logs
  FOR SELECT TO authenticated
  USING (private.is_super_admin() OR (private.is_admin_or_bureau() AND company_id = private.get_my_company_id()));

-- Generic scheduled email reminders
CREATE TABLE public.scheduled_email_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  related_entity_type text NOT NULL,
  related_entity_id uuid,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_email_reminders_status_check
    CHECK (status IN ('pending','processing','sent','failed','cancelled'))
);

-- Duplicate protection: one pending reminder per entity + type
CREATE UNIQUE INDEX idx_scheduled_email_reminders_unique_pending
  ON public.scheduled_email_reminders (company_id, related_entity_type, related_entity_id, email_type)
  WHERE status IN ('pending','processing');

CREATE INDEX idx_scheduled_email_reminders_due
  ON public.scheduled_email_reminders (status, scheduled_for);

GRANT SELECT, INSERT, UPDATE ON public.scheduled_email_reminders TO authenticated;
GRANT ALL ON public.scheduled_email_reminders TO service_role;
ALTER TABLE public.scheduled_email_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_email_reminders_select" ON public.scheduled_email_reminders
  FOR SELECT TO authenticated
  USING (private.is_super_admin() OR (private.is_admin_or_bureau() AND company_id = private.get_my_company_id()));
CREATE POLICY "scheduled_email_reminders_insert" ON public.scheduled_email_reminders
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin() OR (private.is_admin_or_bureau() AND company_id = private.get_my_company_id()));
CREATE POLICY "scheduled_email_reminders_update" ON public.scheduled_email_reminders
  FOR UPDATE TO authenticated
  USING (private.is_super_admin() OR (private.is_admin_or_bureau() AND company_id = private.get_my_company_id()))
  WITH CHECK (private.is_super_admin() OR (private.is_admin_or_bureau() AND company_id = private.get_my_company_id()));

CREATE TRIGGER update_scheduled_email_reminders_updated_at
  BEFORE UPDATE ON public.scheduled_email_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_company_id_scheduled_email_reminders
  BEFORE INSERT ON public.scheduled_email_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

-- Atomic claim of due reminders (prevents double processing)
CREATE OR REPLACE FUNCTION public.claim_due_email_reminders(batch_size integer DEFAULT 25)
RETURNS SETOF public.scheduled_email_reminders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.scheduled_email_reminders r
  SET status = 'processing', attempts = r.attempts + 1, updated_at = now()
  WHERE r.id IN (
    SELECT id FROM public.scheduled_email_reminders
    WHERE status = 'pending' AND scheduled_for <= now()
    ORDER BY scheduled_for
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.*;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_due_email_reminders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_email_reminders(integer) TO service_role;