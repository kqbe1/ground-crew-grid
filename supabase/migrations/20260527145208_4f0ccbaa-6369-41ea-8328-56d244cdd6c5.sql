CREATE OR REPLACE FUNCTION public.restrict_user_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role / backend (edge functions) bypass restrictions entirely
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