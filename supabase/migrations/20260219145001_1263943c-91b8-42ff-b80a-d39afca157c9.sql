
DROP POLICY "Admin can delete tasks" ON public.work_tasks;

CREATE POLICY "Admin/secretariat can delete tasks"
ON public.work_tasks
FOR DELETE
USING (is_admin_or_secretariat());
