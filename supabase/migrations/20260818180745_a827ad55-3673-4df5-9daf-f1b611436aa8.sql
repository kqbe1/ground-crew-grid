
CREATE OR REPLACE FUNCTION public.validate_client_site_refs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.clients WHERE id = NEW.client_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Client introuvable pour ce site';
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company;
  ELSIF NEW.company_id <> v_company THEN
    RAISE EXCEPTION 'Le client lié appartient à une autre entreprise';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_client_site_refs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_client_site_refs ON public.client_sites;
CREATE TRIGGER trg_validate_client_site_refs
BEFORE INSERT OR UPDATE OF client_id, company_id ON public.client_sites
FOR EACH ROW EXECUTE FUNCTION public.validate_client_site_refs();

CREATE OR REPLACE FUNCTION public.validate_client_equipment_refs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.client_sites WHERE id = NEW.client_site_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Site introuvable pour cet équipement';
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company;
  ELSIF NEW.company_id <> v_company THEN
    RAISE EXCEPTION 'Le site lié appartient à une autre entreprise';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_client_equipment_refs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_client_equipment_refs ON public.client_equipment;
CREATE TRIGGER trg_validate_client_equipment_refs
BEFORE INSERT OR UPDATE OF client_site_id, company_id ON public.client_equipment
FOR EACH ROW EXECUTE FUNCTION public.validate_client_equipment_refs();

CREATE OR REPLACE FUNCTION public.validate_task_client_refs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_company uuid;
  v_site RECORD;
  v_eq RECORD;
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    SELECT company_id INTO v_client_company FROM public.clients WHERE id = NEW.client_id;
    IF v_client_company IS NULL THEN
      RAISE EXCEPTION 'Client introuvable';
    END IF;
    IF NEW.company_id IS NOT NULL AND NEW.company_id <> v_client_company THEN
      RAISE EXCEPTION 'Le client lié appartient à une autre entreprise';
    END IF;
  END IF;

  IF NEW.client_site_id IS NOT NULL THEN
    SELECT client_id, company_id INTO v_site FROM public.client_sites WHERE id = NEW.client_site_id;
    IF v_site IS NULL THEN
      RAISE EXCEPTION 'Site introuvable';
    END IF;
    IF NEW.company_id IS NOT NULL AND NEW.company_id <> v_site.company_id THEN
      RAISE EXCEPTION 'Le site lié appartient à une autre entreprise';
    END IF;
    IF NEW.client_id IS NULL THEN
      NEW.client_id := v_site.client_id;
    ELSIF NEW.client_id <> v_site.client_id THEN
      RAISE EXCEPTION 'Le site lié appartient à un autre client';
    END IF;
  END IF;

  IF NEW.equipment_id IS NOT NULL THEN
    SELECT e.client_site_id AS site_id, e.company_id AS company_id, s.client_id AS client_id
      INTO v_eq
      FROM public.client_equipment e
      JOIN public.client_sites s ON s.id = e.client_site_id
     WHERE e.id = NEW.equipment_id;
    IF v_eq IS NULL THEN
      RAISE EXCEPTION 'Équipement introuvable';
    END IF;
    IF NEW.company_id IS NOT NULL AND NEW.company_id <> v_eq.company_id THEN
      RAISE EXCEPTION 'L''équipement lié appartient à une autre entreprise';
    END IF;
    IF NEW.client_site_id IS NULL THEN
      NEW.client_site_id := v_eq.site_id;
    ELSIF NEW.client_site_id <> v_eq.site_id THEN
      RAISE EXCEPTION 'L''équipement lié appartient à un autre site';
    END IF;
    IF NEW.client_id IS NULL THEN
      NEW.client_id := v_eq.client_id;
    ELSIF NEW.client_id <> v_eq.client_id THEN
      RAISE EXCEPTION 'L''équipement lié appartient à un autre client';
    END IF;
  END IF;

  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_task_client_refs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_task_client_refs ON public.work_tasks;
CREATE TRIGGER trg_validate_task_client_refs
BEFORE INSERT OR UPDATE OF client_id, client_site_id, equipment_id, company_id ON public.work_tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task_client_refs();

DROP TRIGGER IF EXISTS trg_validate_maintenance_client_refs ON public.maintenance_schedules;
CREATE TRIGGER trg_validate_maintenance_client_refs
BEFORE INSERT OR UPDATE OF client_id, client_site_id, equipment_id, company_id ON public.maintenance_schedules
FOR EACH ROW EXECUTE FUNCTION public.validate_task_client_refs();

CREATE OR REPLACE FUNCTION public.prevent_delete_client_with_final_sheet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.intervention_sheets sh
    JOIN public.work_tasks t ON t.id = sh.work_task_id
    WHERE sh.is_draft = false
      AND (
        (TG_TABLE_NAME = 'clients' AND t.client_id = OLD.id)
        OR (TG_TABLE_NAME = 'client_sites' AND t.client_site_id = OLD.id)
        OR (TG_TABLE_NAME = 'client_equipment' AND t.equipment_id = OLD.id)
      )
  ) THEN
    RAISE EXCEPTION 'Suppression impossible : des fiches d''intervention définitives sont rattachées (historique protégé).';
  END IF;
  RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION public.prevent_delete_client_with_final_sheet() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_delete_client_with_final_sheet ON public.clients;
CREATE TRIGGER trg_prevent_delete_client_with_final_sheet
BEFORE DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_client_with_final_sheet();

DROP TRIGGER IF EXISTS trg_prevent_delete_site_with_final_sheet ON public.client_sites;
CREATE TRIGGER trg_prevent_delete_site_with_final_sheet
BEFORE DELETE ON public.client_sites
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_client_with_final_sheet();

DROP TRIGGER IF EXISTS trg_prevent_delete_equipment_with_final_sheet ON public.client_equipment;
CREATE TRIGGER trg_prevent_delete_equipment_with_final_sheet
BEFORE DELETE ON public.client_equipment
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_client_with_final_sheet();
