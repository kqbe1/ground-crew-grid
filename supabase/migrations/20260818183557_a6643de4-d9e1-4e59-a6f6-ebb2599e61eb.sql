
CREATE OR REPLACE FUNCTION public.validate_task_binome_template_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  IF TG_TABLE_NAME = 'work_tasks'
     AND NEW.template_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.template_id IS DISTINCT FROM OLD.template_id) THEN
    SELECT company_id INTO v_company FROM public.task_templates WHERE id = NEW.template_id;
    IF v_company IS NULL THEN
      RAISE EXCEPTION 'Modèle de tâche introuvable';
    END IF;
    IF NEW.company_id IS NOT NULL AND NEW.company_id <> v_company THEN
      RAISE EXCEPTION 'Le modèle lié appartient à une autre entreprise';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_task_binome_template_refs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_task_binome_template_refs ON public.work_tasks;
CREATE TRIGGER trg_validate_task_binome_template_refs
BEFORE INSERT OR UPDATE ON public.work_tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task_binome_template_refs();

DROP TRIGGER IF EXISTS trg_validate_maintenance_binome_refs ON public.maintenance_schedules;
CREATE TRIGGER trg_validate_maintenance_binome_refs
BEFORE INSERT OR UPDATE ON public.maintenance_schedules
FOR EACH ROW EXECUTE FUNCTION public.validate_task_binome_template_refs();
