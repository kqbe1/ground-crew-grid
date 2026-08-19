-- Restore Data API privileges (GRANTs) lost on the public schema.
-- RLS policies already enforce company_id isolation; without GRANTs PostgREST returns 403.

-- Service role (bypasses RLS, used by edge functions) on every public table
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END $$;

-- Tenant tables: full CRUD for authenticated, rows filtered by existing RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_equipment TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.binomes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_binomes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_email_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_maintenance_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- No DELETE policy exists on these: grant only what the policies allow
GRANT SELECT, INSERT, UPDATE ON public.intervention_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.scheduled_email_reminders TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.work_task_assignees TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.maintenance_schedule_assignees TO authenticated;
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT SELECT ON public.email_logs TO authenticated;

-- profiles: no INSERT/DELETE policy (profiles are created server-side)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Sequences used by the above tables
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='S'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', s.relname);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', s.relname);
  END LOOP;
END $$;