-- 1. Coherence constraints on work_tasks (existing data already compliant)
ALTER TABLE public.work_tasks
  ADD CONSTRAINT work_tasks_duration_valid CHECK (duration_minutes >= 5 AND duration_minutes <= 1440),
  ADD CONSTRAINT work_tasks_fits_in_day CHECK ((EXTRACT(EPOCH FROM start_time) / 60) + duration_minutes <= 1440),
  ADD CONSTRAINT work_tasks_distinct_assignees CHECK (second_assigned_to IS NULL OR second_assigned_to IS DISTINCT FROM assigned_to);

-- 2. Keep work_task_assignees in sync with assigned_to / second_assigned_to
CREATE OR REPLACE FUNCTION public.sync_task_assignees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- remove assignee rows for workers no longer referenced by the task
    IF OLD.assigned_to IS NOT NULL
       AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
       AND OLD.assigned_to IS DISTINCT FROM NEW.second_assigned_to THEN
      DELETE FROM public.work_task_assignees
        WHERE work_task_id = NEW.id AND user_id = OLD.assigned_to;
    END IF;
    IF OLD.second_assigned_to IS NOT NULL
       AND OLD.second_assigned_to IS DISTINCT FROM NEW.second_assigned_to
       AND OLD.second_assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      DELETE FROM public.work_task_assignees
        WHERE work_task_id = NEW.id AND user_id = OLD.second_assigned_to;
    END IF;
  END IF;

  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.work_task_assignees (work_task_id, user_id, company_id)
    VALUES (NEW.id, NEW.assigned_to, NEW.company_id)
    ON CONFLICT (work_task_id, user_id) DO NOTHING;
  END IF;
  IF NEW.second_assigned_to IS NOT NULL THEN
    INSERT INTO public.work_task_assignees (work_task_id, user_id, company_id)
    VALUES (NEW.id, NEW.second_assigned_to, NEW.company_id)
    ON CONFLICT (work_task_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_assignees ON public.work_tasks;
CREATE TRIGGER trg_sync_task_assignees
AFTER INSERT OR UPDATE OF assigned_to, second_assigned_to ON public.work_tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_task_assignees();

-- backfill existing tasks
INSERT INTO public.work_task_assignees (work_task_id, user_id, company_id)
SELECT t.id, t.assigned_to, t.company_id FROM public.work_tasks t WHERE t.assigned_to IS NOT NULL
ON CONFLICT (work_task_id, user_id) DO NOTHING;
INSERT INTO public.work_task_assignees (work_task_id, user_id, company_id)
SELECT t.id, t.second_assigned_to, t.company_id FROM public.work_tasks t WHERE t.second_assigned_to IS NOT NULL
ON CONFLICT (work_task_id, user_id) DO NOTHING;