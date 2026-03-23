
ALTER TABLE public.parts_orders
  DROP CONSTRAINT parts_orders_work_task_id_fkey,
  ADD CONSTRAINT parts_orders_work_task_id_fkey
    FOREIGN KEY (work_task_id) REFERENCES public.work_tasks(id) ON DELETE SET NULL;

ALTER TABLE public.intervention_sheets
  DROP CONSTRAINT intervention_sheets_work_task_id_fkey,
  ADD CONSTRAINT intervention_sheets_work_task_id_fkey
    FOREIGN KEY (work_task_id) REFERENCES public.work_tasks(id) ON DELETE CASCADE;
