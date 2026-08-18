-- 1. Cohérence des rôles : seuls admin/bureau (ou super admin) gèrent les assignations de tâches
DROP POLICY IF EXISTS "company_insert_wta" ON public.work_task_assignees;
DROP POLICY IF EXISTS "company_delete_wta" ON public.work_task_assignees;

CREATE POLICY "company_insert_wta" ON public.work_task_assignees
FOR INSERT TO authenticated
WITH CHECK (((company_id = private.get_my_company_id()) AND private.is_admin_or_bureau()) OR private.is_super_admin());

CREATE POLICY "company_delete_wta" ON public.work_task_assignees
FOR DELETE TO authenticated
USING (((company_id = private.get_my_company_id()) AND private.is_admin_or_bureau()) OR private.is_super_admin());

-- 2. Protection de l'historique : interdire la suppression d'une tâche portant une fiche définitive
CREATE OR REPLACE FUNCTION public.prevent_delete_task_with_final_sheet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.intervention_sheets s
    WHERE s.work_task_id = OLD.id AND s.is_draft = false
  ) THEN
    RAISE EXCEPTION 'Suppression impossible : cette tâche possède une fiche d''intervention définitive (historique protégé).';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_task_with_final_sheet ON public.work_tasks;
CREATE TRIGGER trg_prevent_delete_task_with_final_sheet
BEFORE DELETE ON public.work_tasks
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_task_with_final_sheet();

-- 3. Éviter les blocages/orphelins lors de la suppression d'un site ou d'un équipement :
--    les tâches et entretiens conservent leur historique avec une référence vidée.
ALTER TABLE public.work_tasks DROP CONSTRAINT work_tasks_client_site_id_fkey,
  ADD CONSTRAINT work_tasks_client_site_id_fkey FOREIGN KEY (client_site_id)
  REFERENCES public.client_sites(id) ON DELETE SET NULL;

ALTER TABLE public.work_tasks DROP CONSTRAINT work_tasks_equipment_id_fkey,
  ADD CONSTRAINT work_tasks_equipment_id_fkey FOREIGN KEY (equipment_id)
  REFERENCES public.client_equipment(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_schedules DROP CONSTRAINT maintenance_schedules_client_site_id_fkey,
  ADD CONSTRAINT maintenance_schedules_client_site_id_fkey FOREIGN KEY (client_site_id)
  REFERENCES public.client_sites(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_schedules DROP CONSTRAINT maintenance_schedules_equipment_id_fkey,
  ADD CONSTRAINT maintenance_schedules_equipment_id_fkey FOREIGN KEY (equipment_id)
  REFERENCES public.client_equipment(id) ON DELETE SET NULL;

ALTER TABLE public.work_tasks DROP CONSTRAINT work_tasks_template_id_fkey,
  ADD CONSTRAINT work_tasks_template_id_fkey FOREIGN KEY (template_id)
  REFERENCES public.task_templates(id) ON DELETE SET NULL;
