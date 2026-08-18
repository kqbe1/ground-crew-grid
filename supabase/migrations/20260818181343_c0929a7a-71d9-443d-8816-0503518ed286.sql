-- 1. Reset des marqueurs de rappel quand l'échéance change ou que l'entretien est réactivé
CREATE OR REPLACE FUNCTION public.reset_maintenance_reminder_on_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.next_due_date IS DISTINCT FROM OLD.next_due_date
     OR (NEW.status = 'actif' AND OLD.status IS DISTINCT FROM 'actif') THEN
    NEW.reminder_sent_at := NULL;
    NEW.reminder_sent_for_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_maintenance_reminder ON public.maintenance_schedules;
CREATE TRIGGER trg_reset_maintenance_reminder
BEFORE UPDATE ON public.maintenance_schedules
FOR EACH ROW EXECUTE FUNCTION public.reset_maintenance_reminder_on_change();

-- 2. Cohérence des dates : la prochaine échéance ne peut pas précéder le dernier entretien
ALTER TABLE public.maintenance_schedules
  DROP CONSTRAINT IF EXISTS maintenance_schedules_dates_coherent;
ALTER TABLE public.maintenance_schedules
  ADD CONSTRAINT maintenance_schedules_dates_coherent
  CHECK (last_done_date IS NULL OR next_due_date > last_done_date);
