-- task_templates.created_by
ALTER TABLE public.task_templates DROP CONSTRAINT task_templates_created_by_fkey;
ALTER TABLE public.task_templates ADD CONSTRAINT task_templates_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- work_tasks.assigned_to
ALTER TABLE public.work_tasks DROP CONSTRAINT work_tasks_assigned_to_fkey;
ALTER TABLE public.work_tasks ADD CONSTRAINT work_tasks_assigned_to_fkey 
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- work_tasks.second_assigned_to
ALTER TABLE public.work_tasks DROP CONSTRAINT work_tasks_second_assigned_to_fkey;
ALTER TABLE public.work_tasks ADD CONSTRAINT work_tasks_second_assigned_to_fkey 
  FOREIGN KEY (second_assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- work_tasks.created_by
ALTER TABLE public.work_tasks DROP CONSTRAINT work_tasks_created_by_fkey;
ALTER TABLE public.work_tasks ADD CONSTRAINT work_tasks_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- intervention_sheets.worker_id
ALTER TABLE public.intervention_sheets DROP CONSTRAINT intervention_sheets_worker_id_fkey;
ALTER TABLE public.intervention_sheets ADD CONSTRAINT intervention_sheets_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- parts_orders.requested_by
ALTER TABLE public.parts_orders DROP CONSTRAINT parts_orders_requested_by_fkey;
ALTER TABLE public.parts_orders ADD CONSTRAINT parts_orders_requested_by_fkey 
  FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Make worker_id and created_by nullable where needed
ALTER TABLE public.intervention_sheets ALTER COLUMN worker_id DROP NOT NULL;
ALTER TABLE public.work_tasks ALTER COLUMN created_by DROP NOT NULL;