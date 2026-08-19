-- Fix remaining Data API permissions after the Supabase migration.
-- Only GRANT/REVOKE + RLS enablement. No policy, table, function or data is dropped.
-- Security model is unchanged: RLS (company_id + private.* role helpers) remains the
-- single source of truth; grants are only the Data API gate.

BEGIN;

-- 1. anon must never reach business tables (no policy targets anon).
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.relname);
  END LOOP;
END $$;

-- 2. RLS must stay enabled on every public table (idempotent).
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

-- 3. service_role (edge functions, crons) on every public table.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END $$;

-- 4. authenticated: grants strictly aligned with the existing RLS policies.

-- 4a. Full CRUD (policies scope every operation to company_id + role).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_tasks               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_sites             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_equipment         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_schedules    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_orders             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_templates           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_binomes             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.binomes                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_settings             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_settings           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_email_settings   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_maintenance_rules  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes                   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings        TO authenticated;
-- companies: read is restricted by member_view_company / super admin policies,
-- writes are super-admin-only policies. SELECT was the missing grant causing 403.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies                TO authenticated;

-- 4b. Restricted grants (mirror the tables that intentionally have no policy
--     for a given operation, so the Data API refuses it at grant level too).
GRANT SELECT, UPDATE          ON public.profiles                       TO authenticated; -- no INSERT (trigger), no DELETE
GRANT SELECT, INSERT, UPDATE  ON public.intervention_sheets            TO authenticated; -- DELETE via public.delete_intervention_sheet()
GRANT SELECT, INSERT, DELETE  ON public.work_task_assignees            TO authenticated; -- no UPDATE
GRANT SELECT, INSERT, DELETE  ON public.maintenance_schedule_assignees TO authenticated; -- no UPDATE
GRANT SELECT, INSERT          ON public.activity_logs                  TO authenticated; -- immutable audit log
GRANT SELECT, INSERT, UPDATE  ON public.scheduled_email_reminders      TO authenticated; -- no DELETE
GRANT SELECT                  ON public.email_logs                     TO authenticated; -- read-only

-- 4c. Purely technical tables stay service_role-only:
--     email_send_log, email_send_state, email_unsubscribe_tokens, suppressed_emails.

-- 5. RPC used by the frontend.
REVOKE ALL ON FUNCTION public.get_my_clients_safe()                               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_company_full()                               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_intervention_sheet(uuid, text)               FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_clients_safe()                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_company_full()                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_intervention_sheet(uuid, text) TO authenticated, service_role;

-- Admin-only helper: service_role only.
REVOKE ALL ON FUNCTION public.list_security_definer_violations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_security_definer_violations() TO service_role;

COMMIT;
