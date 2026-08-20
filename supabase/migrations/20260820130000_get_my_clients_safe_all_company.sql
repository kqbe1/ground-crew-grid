-- Remplace get_my_clients_safe() : retourne tous les clients de l'entreprise
-- de l'utilisateur connecte (isolation assuree par la RLS de public.clients,
-- la fonction restant en SECURITY INVOKER).
CREATE OR REPLACE FUNCTION public.get_my_clients_safe()
RETURNS TABLE(
  id uuid,
  name text,
  phone text,
  email text,
  address_intervention text,
  postal_code text,
  city text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.name,
    c.phone,
    c.email,
    c.address_intervention,
    c.postal_code,
    c.city
  FROM public.clients c
  ORDER BY c.name
$function$;
