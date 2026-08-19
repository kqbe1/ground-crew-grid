-- Harden set_company_id(): prevent any user from forcing another company's id
CREATE OR REPLACE FUNCTION public.set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_my_company uuid;
BEGIN
  -- Backend / service_role operations keep full control
  IF auth.uid() IS NULL OR private.is_super_admin() THEN
    IF NEW.company_id IS NULL THEN
      NEW.company_id := private.get_my_company_id();
    END IF;
    RETURN NEW;
  END IF;

  v_my_company := private.get_my_company_id();

  IF v_my_company IS NULL THEN
    RAISE EXCEPTION 'Compte inactif ou sans entreprise : opération refusée';
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_my_company;
  ELSIF NEW.company_id <> v_my_company THEN
    RAISE EXCEPTION 'company_id invalide : opération refusée';
  END IF;

  RETURN NEW;
END;
$$;

-- Keep company_id immutable on UPDATE for regular users (defence in depth)
CREATE OR REPLACE FUNCTION public.lock_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR private.is_super_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    NEW.company_id := OLD.company_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_company_id() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','client_sites','client_equipment','work_tasks','intervention_sheets',
    'parts_orders','maintenance_schedules','task_templates','pdf_settings','binomes',
    'task_binomes','work_task_assignees','maintenance_schedule_assignees',
    'company_email_settings','scheduled_email_reminders','quotes'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS lock_company_id_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER lock_company_id_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.lock_company_id()', t);
  END LOOP;
END $$;

-- Ensure set_company_id trigger exists on every business table that has company_id
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','client_sites','client_equipment','work_tasks','intervention_sheets',
    'parts_orders','maintenance_schedules','task_templates','pdf_settings','binomes',
    'task_binomes','work_task_assignees','maintenance_schedule_assignees',
    'company_email_settings','scheduled_email_reminders','quotes'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
      WHERE tg.tgrelid = format('public.%I', t)::regclass
        AND NOT tg.tgisinternal
        AND tg.tgfoid = 'public.set_company_id()'::regprocedure
    ) THEN
      EXECUTE format('CREATE TRIGGER set_company_id_%1$s BEFORE INSERT ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_company_id()', t);
    END IF;
  END LOOP;
END $$;

-- Explicit WITH CHECK on business UPDATE policies (avoid relying on implicit USING)
DO $$
DECLARE r record; expr text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual
    FROM pg_policies
    WHERE schemaname='public' AND cmd='UPDATE' AND with_check IS NULL
      AND tablename IN ('clients','client_sites','client_equipment','work_tasks',
        'maintenance_schedules','task_templates','pdf_settings','binomes','quotes')
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
      r.policyname, r.tablename, r.qual, r.qual);
  END LOOP;
END $$;