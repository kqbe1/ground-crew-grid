
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS owner_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_owner_client_id_idx ON public.clients(owner_client_id);
