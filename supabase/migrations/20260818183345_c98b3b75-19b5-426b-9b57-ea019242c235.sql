
-- 1) Heures cohérentes sur les fiches définitives
ALTER TABLE public.intervention_sheets
  ADD CONSTRAINT intervention_sheets_valid_hours
  CHECK (
    is_draft
    OR arrival_time IS NULL
    OR departure_time IS NULL
    OR departure_time > arrival_time
  ) NOT VALID;

-- 2) Synchronisation statut fiche -> tâche (côté base)
CREATE OR REPLACE FUNCTION public.sync_task_status_from_sheet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task_status task_status;
BEGIN
  IF NEW.is_draft THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_task_status FROM public.work_tasks WHERE id = NEW.work_task_id;
  IF v_task_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ne pas revenir en arrière si les pièces ont déjà été reçues
  IF v_task_status = 'a_replanifier' AND NEW.final_status = 'piece_a_commander' THEN
    RETURN NEW;
  END IF;

  IF v_task_status IS DISTINCT FROM NEW.final_status THEN
    UPDATE public.work_tasks SET status = NEW.final_status WHERE id = NEW.work_task_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_status_from_sheet ON public.intervention_sheets;
CREATE TRIGGER trg_sync_task_status_from_sheet
AFTER INSERT OR UPDATE OF final_status, is_draft ON public.intervention_sheets
FOR EACH ROW EXECUTE FUNCTION public.sync_task_status_from_sheet();
