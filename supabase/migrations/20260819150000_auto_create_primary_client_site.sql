-- Ensure every newly created client with an intervention address has a primary site.
-- This keeps equipment creation reliable: client_equipment must reference a client_site.
-- SECURITY DEFINER is used because the trigger runs as part of client creation and must not
-- depend on the caller's client_sites INSERT policy.

CREATE OR REPLACE FUNCTION public.ensure_primary_client_site()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.address_intervention IS NOT NULL AND btrim(NEW.address_intervention) <> '' THEN
    INSERT INTO public.client_sites (client_id, name, address, is_primary)
    SELECT NEW.id, 'Adresse principale', btrim(NEW.address_intervention), true
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.client_sites
      WHERE client_id = NEW.id
        AND (is_primary = true OR name = 'Adresse principale')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_primary_client_site_on_client_insert ON public.clients;

CREATE TRIGGER ensure_primary_client_site_on_client_insert
AFTER INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.ensure_primary_client_site();
