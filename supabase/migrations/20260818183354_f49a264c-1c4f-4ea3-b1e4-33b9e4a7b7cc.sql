
REVOKE ALL ON FUNCTION public.sync_task_status_from_sheet() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.intervention_sheets VALIDATE CONSTRAINT intervention_sheets_valid_hours;
