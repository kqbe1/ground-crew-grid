DO $$
DECLARE v_client uuid; v_company uuid; v_id uuid; v_task uuid;
BEGIN
  SELECT id, company_id INTO v_client, v_company FROM public.clients LIMIT 1;
  IF v_client IS NULL THEN RAISE NOTICE 'no client, skip'; RETURN; END IF;
  INSERT INTO public.maintenance_schedules (client_id, company_id, intervention_type, periodicity, next_due_date, status)
  VALUES (v_client, v_company, 'entretien_gaz', 'annuel', current_date + 30, 'actif') RETURNING id INTO v_id;
  UPDATE public.maintenance_schedules SET notes = 'selftest', next_due_date = current_date + 60 WHERE id = v_id;
  DELETE FROM public.maintenance_schedules WHERE id = v_id;

  INSERT INTO public.work_tasks (title, intervention_type, status, scheduled_date, start_time, duration_minutes, client_id, company_id)
  VALUES ('selftest', 'depannage', 'planifie', current_date, '09:00', 60, v_client, v_company) RETURNING id INTO v_task;
  UPDATE public.work_tasks SET description = 'selftest' WHERE id = v_task;
  DELETE FROM public.work_tasks WHERE id = v_task;
  RAISE NOTICE 'selftest OK';
END $$;