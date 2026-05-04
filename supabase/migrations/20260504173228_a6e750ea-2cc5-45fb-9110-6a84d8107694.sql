-- Function: re-applique la planification du job cron security-monitor à partir de platform_settings
CREATE OR REPLACE FUNCTION private.apply_security_monitor_schedule()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
  v_schedule text;
  v_job_id bigint;
BEGIN
  -- Lire la valeur configurée (fallback : toutes les heures)
  SELECT trim(both '"' from value::text)
    INTO v_schedule
  FROM public.platform_settings
  WHERE key = 'security_monitor_cron_schedule'
  LIMIT 1;

  IF v_schedule IS NULL OR v_schedule = '' THEN
    v_schedule := '0 * * * *';
  END IF;

  -- Récupérer l'ID du job existant
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'security-monitor-hourly'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := v_job_id, schedule := v_schedule);
    RETURN format('Reprogrammé (jobid=%s) avec schedule=%s', v_job_id, v_schedule);
  ELSE
    RETURN format('Job security-monitor-hourly absent — schedule cible=%s (créer via insert tool)', v_schedule);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.apply_security_monitor_schedule() FROM PUBLIC, anon, authenticated;

-- Trigger : reprogrammer automatiquement quand la clé est modifiée
CREATE OR REPLACE FUNCTION private.tg_apply_security_monitor_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
  IF NEW.key = 'security_monitor_cron_schedule' THEN
    PERFORM private.apply_security_monitor_schedule();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_security_monitor_schedule ON public.platform_settings;
CREATE TRIGGER trg_apply_security_monitor_schedule
AFTER INSERT OR UPDATE OF value ON public.platform_settings
FOR EACH ROW
WHEN (NEW.key = 'security_monitor_cron_schedule')
EXECUTE FUNCTION private.tg_apply_security_monitor_schedule();