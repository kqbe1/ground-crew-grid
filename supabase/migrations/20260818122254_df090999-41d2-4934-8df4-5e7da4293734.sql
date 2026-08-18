-- 1. Multi-assignee tables
CREATE TABLE public.work_task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_task_id uuid NOT NULL REFERENCES public.work_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_task_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_task_assignees TO authenticated;
GRANT ALL ON public.work_task_assignees TO service_role;
ALTER TABLE public.work_task_assignees ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.maintenance_schedule_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_schedule_id uuid NOT NULL REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (maintenance_schedule_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_schedule_assignees TO authenticated;
GRANT ALL ON public.maintenance_schedule_assignees TO service_role;
ALTER TABLE public.maintenance_schedule_assignees ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_company_id_work_task_assignees BEFORE INSERT ON public.work_task_assignees
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_maintenance_schedule_assignees BEFORE INSERT ON public.maintenance_schedule_assignees
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

CREATE POLICY "company_select_wta" ON public.work_task_assignees FOR SELECT TO authenticated
  USING ((company_id = private.get_my_company_id()) OR private.is_super_admin());
CREATE POLICY "company_insert_wta" ON public.work_task_assignees FOR INSERT TO authenticated
  WITH CHECK (((company_id = private.get_my_company_id()) AND (private.is_admin_or_bureau() OR user_id = auth.uid())) OR private.is_super_admin());
CREATE POLICY "company_delete_wta" ON public.work_task_assignees FOR DELETE TO authenticated
  USING (((company_id = private.get_my_company_id()) AND (private.is_admin_or_bureau() OR user_id = auth.uid())) OR private.is_super_admin());

CREATE POLICY "company_select_msa" ON public.maintenance_schedule_assignees FOR SELECT TO authenticated
  USING ((company_id = private.get_my_company_id()) OR private.is_super_admin());
CREATE POLICY "company_insert_msa" ON public.maintenance_schedule_assignees FOR INSERT TO authenticated
  WITH CHECK (((company_id = private.get_my_company_id()) AND private.is_admin_or_bureau()) OR private.is_super_admin());
CREATE POLICY "company_delete_msa" ON public.maintenance_schedule_assignees FOR DELETE TO authenticated
  USING (((company_id = private.get_my_company_id()) AND private.is_admin_or_bureau()) OR private.is_super_admin());

-- 2. Helper so workers listed in work_task_assignees can read/update their tasks
CREATE OR REPLACE FUNCTION private.is_task_assignee(_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.work_task_assignees a WHERE a.work_task_id = _task_id AND a.user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION private.is_task_assignee(uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "company_select_work_tasks" ON public.work_tasks;
CREATE POLICY "company_select_work_tasks" ON public.work_tasks FOR SELECT TO authenticated
  USING (((company_id = private.get_my_company_id()) AND (private.is_admin_or_bureau() OR (assigned_to = auth.uid()) OR (second_assigned_to = auth.uid()) OR private.is_task_assignee(id))) OR private.is_super_admin());

DROP POLICY IF EXISTS "company_update_work_tasks" ON public.work_tasks;
CREATE POLICY "company_update_work_tasks" ON public.work_tasks FOR UPDATE TO authenticated
  USING (((company_id = private.get_my_company_id()) AND (private.is_admin_or_bureau() OR (assigned_to = auth.uid()) OR (second_assigned_to = auth.uid()) OR private.is_task_assignee(id))) OR private.is_super_admin());

-- Allow a worker to create an urgent task assigned to themself
DROP POLICY IF EXISTS "company_insert_work_tasks" ON public.work_tasks;
CREATE POLICY "company_insert_work_tasks" ON public.work_tasks FOR INSERT TO authenticated
  WITH CHECK (((company_id = private.get_my_company_id()) AND (private.is_admin_or_bureau() OR (assigned_to = auth.uid() AND created_by = auth.uid()))) OR private.is_super_admin());

-- 3. Entretien reminder tracking + settings
ALTER TABLE public.maintenance_schedules
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_for_date date;

ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS auto_reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_days_before integer NOT NULL DEFAULT 30;

-- 4. Remove client region
ALTER TABLE public.clients DROP COLUMN IF EXISTS region;
DROP TYPE IF EXISTS public.client_region;