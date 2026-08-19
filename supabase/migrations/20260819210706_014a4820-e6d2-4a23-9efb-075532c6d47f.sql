CREATE OR REPLACE FUNCTION public.validate_maintenance_binome_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
  v_active boolean;
BEGIN
  IF NEW.binome_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.binome_id IS DISTINCT FROM OLD.binome_id) THEN
    SELECT company_id, is_active INTO v_company, v_active
      FROM public.task_binomes WHERE id = NEW.binome_id;
    IF v_company IS NULL THEN
      RAISE EXCEPTION 'Binôme introuvable';
    END IF;
    IF NEW.company_id IS NOT NULL AND NEW.company_id <> v_company THEN
      RAISE EXCEPTION 'Le binôme lié appartient à une autre entreprise';
    END IF;
    IF NOT v_active THEN
      RAISE EXCEPTION 'Ce binôme est désactivé et ne peut pas être assigné';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_maintenance_binome_ref() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_maintenance_binome_refs ON public.maintenance_schedules;
CREATE TRIGGER trg_validate_maintenance_binome_refs
BEFORE INSERT OR UPDATE ON public.maintenance_schedules
FOR EACH ROW EXECUTE FUNCTION public.validate_maintenance_binome_ref();