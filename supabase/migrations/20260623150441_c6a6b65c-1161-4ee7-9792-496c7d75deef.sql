ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.client_sites ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.client_sites ADD COLUMN IF NOT EXISTS city text;

DROP FUNCTION IF EXISTS public.get_my_clients_safe();

CREATE FUNCTION public.get_my_clients_safe()
RETURNS TABLE(
  id uuid,
  name text,
  phone text,
  email text,
  address_intervention text,
  postal_code text,
  city text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT DISTINCT
    c.id,
    c.name,
    c.phone,
    c.email,
    c.address_intervention,
    c.postal_code,
    c.city
  FROM public.clients c
  INNER JOIN public.work_tasks wt ON wt.client_id = c.id
  WHERE wt.assigned_to = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_clients_safe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_clients_safe() TO authenticated;