
-- Trigger to prevent ouvriers from modifying protected columns on work_tasks
CREATE OR REPLACE FUNCTION public.restrict_ouvrier_task_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only restrict ouvriers
  IF NOT public.is_ouvrier() THEN
    RETURN NEW;
  END IF;

  -- Block changes to protected columns by resetting them to OLD values
  NEW.memo_secretariat := OLD.memo_secretariat;
  NEW.assigned_to := OLD.assigned_to;
  NEW.second_assigned_to := OLD.second_assigned_to;
  NEW.client_id := OLD.client_id;
  NEW.client_site_id := OLD.client_site_id;
  NEW.equipment_id := OLD.equipment_id;
  NEW.created_by := OLD.created_by;
  NEW.intervention_type := OLD.intervention_type;
  NEW.title := OLD.title;
  NEW.scheduled_date := OLD.scheduled_date;
  NEW.start_time := OLD.start_time;
  NEW.duration_minutes := OLD.duration_minutes;
  NEW.template_id := OLD.template_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_ouvrier_task_update
  BEFORE UPDATE ON public.work_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_ouvrier_task_update();
