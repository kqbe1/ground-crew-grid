
CREATE POLICY "Ouvrier can view clients for assigned tasks"
ON public.clients
FOR SELECT
TO public
USING (
  is_ouvrier() AND id IN (
    SELECT client_id FROM public.work_tasks
    WHERE assigned_to = auth.uid() AND client_id IS NOT NULL
  )
);
