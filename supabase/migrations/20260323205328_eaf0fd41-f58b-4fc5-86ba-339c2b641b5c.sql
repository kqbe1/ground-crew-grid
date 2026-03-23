
-- Drop the broad ouvrier SELECT policy that exposes all client columns
DROP POLICY "Ouvrier can view clients for assigned tasks" ON public.clients;

-- Create a security definer function returning only safe client fields
CREATE OR REPLACE FUNCTION public.get_my_clients_safe()
RETURNS TABLE(id uuid, name text, phone text, email text, address_intervention text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT c.id, c.name, c.phone, c.email, c.address_intervention
  FROM public.clients c
  INNER JOIN public.work_tasks wt ON wt.client_id = c.id
  WHERE wt.assigned_to = auth.uid();
$$;
