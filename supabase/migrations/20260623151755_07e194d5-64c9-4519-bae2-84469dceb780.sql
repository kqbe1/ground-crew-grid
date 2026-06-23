ALTER TABLE public.work_tasks DROP CONSTRAINT work_tasks_client_id_fkey,
  ADD CONSTRAINT work_tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.parts_orders DROP CONSTRAINT parts_orders_client_id_fkey,
  ADD CONSTRAINT parts_orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;