
-- 1. Create task_binomes table
CREATE TABLE public.task_binomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  kind text NOT NULL DEFAULT 'stagiaire',
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_binomes_code_chk CHECK (code ~ '^B([0-9]|1[0-9]|20)$'),
  CONSTRAINT task_binomes_kind_chk CHECK (kind IN ('stagiaire','apprenti','autre')),
  UNIQUE (company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_binomes TO authenticated;
GRANT ALL ON public.task_binomes TO service_role;

ALTER TABLE public.task_binomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "binomes_select_own_company" ON public.task_binomes
  FOR SELECT TO authenticated
  USING (company_id = private.get_my_company_id() OR private.is_super_admin());

CREATE POLICY "binomes_write_admin_bureau" ON public.task_binomes
  FOR ALL TO authenticated
  USING (
    (company_id = private.get_my_company_id() AND (private.is_admin() OR private.is_bureau()))
    OR private.is_super_admin()
  )
  WITH CHECK (
    (company_id = private.get_my_company_id() AND (private.is_admin() OR private.is_bureau()))
    OR private.is_super_admin()
  );

CREATE TRIGGER set_task_binomes_company_id
  BEFORE INSERT ON public.task_binomes
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

CREATE TRIGGER update_task_binomes_updated_at
  BEFORE UPDATE ON public.task_binomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Enforce max 20 active binômes per company
CREATE OR REPLACE FUNCTION public.enforce_binomes_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  IF NEW.is_active THEN
    SELECT count(*) INTO cnt FROM public.task_binomes
      WHERE company_id = NEW.company_id AND is_active = true
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    IF cnt >= 20 THEN
      RAISE EXCEPTION 'Limite de 20 binômes actifs atteinte pour cette entreprise';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_task_binomes_limit
  BEFORE INSERT OR UPDATE ON public.task_binomes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_binomes_limit();

-- 3. Redirect existing work_tasks.binome_id FK to task_binomes
UPDATE public.work_tasks SET binome_id = NULL WHERE binome_id IS NOT NULL;
ALTER TABLE public.work_tasks DROP CONSTRAINT IF EXISTS work_tasks_binome_id_fkey;
ALTER TABLE public.work_tasks
  ADD CONSTRAINT work_tasks_binome_id_fkey
  FOREIGN KEY (binome_id) REFERENCES public.task_binomes(id) ON DELETE SET NULL;

-- 4. Preserve binome_id in ouvrier task update restriction
CREATE OR REPLACE FUNCTION public.restrict_ouvrier_task_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT private.is_ouvrier() THEN RETURN NEW; END IF;
  NEW.memo_secretariat:=OLD.memo_secretariat; NEW.assigned_to:=OLD.assigned_to; NEW.second_assigned_to:=OLD.second_assigned_to;
  NEW.binome_id:=OLD.binome_id;
  NEW.client_id:=OLD.client_id; NEW.client_site_id:=OLD.client_site_id; NEW.equipment_id:=OLD.equipment_id;
  NEW.created_by:=OLD.created_by; NEW.intervention_type:=OLD.intervention_type; NEW.title:=OLD.title;
  NEW.scheduled_date:=OLD.scheduled_date; NEW.start_time:=OLD.start_time; NEW.duration_minutes:=OLD.duration_minutes; NEW.template_id:=OLD.template_id;
  RETURN NEW;
END; $function$;

-- 5. Drop binome_level column on profiles + update restriction trigger
CREATE OR REPLACE FUNCTION public.restrict_user_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF private.is_super_admin() THEN RETURN NEW; END IF;
  IF private.is_admin() OR private.is_bureau() THEN
    IF OLD.role IN ('admin','super_admin') AND OLD.id <> auth.uid() THEN
      NEW.is_active := OLD.is_active;
      NEW.worker_level := OLD.worker_level;
      NEW.role := OLD.role;
    END IF;
    IF OLD.id = auth.uid() THEN
      NEW.is_active := OLD.is_active;
      NEW.role := OLD.role;
    END IF;
    NEW.company_id := OLD.company_id;
    RETURN NEW;
  END IF;
  NEW.worker_level := OLD.worker_level;
  NEW.is_active := OLD.is_active;
  NEW.role := OLD.role;
  NEW.company_id := OLD.company_id;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS binome_level;
