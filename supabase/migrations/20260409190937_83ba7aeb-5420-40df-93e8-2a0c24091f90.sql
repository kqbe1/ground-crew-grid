
-- Log profile changes (create + update)
CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action TEXT;
  v_meta JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create_user';
    v_meta := jsonb_build_object(
      'full_name', NEW.full_name,
      'role', NEW.role,
      'email', NEW.email
    );
    INSERT INTO public.activity_logs (action, actor_id, target_type, target_id, company_id, metadata)
    VALUES (v_action, auth.uid(), 'user', NEW.id, NEW.company_id, v_meta);

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log meaningful changes
    IF OLD.role IS DISTINCT FROM NEW.role
       OR OLD.is_active IS DISTINCT FROM NEW.is_active
       OR OLD.company_id IS DISTINCT FROM NEW.company_id
       OR OLD.full_name IS DISTINCT FROM NEW.full_name
       OR OLD.worker_level IS DISTINCT FROM NEW.worker_level
    THEN
      v_action := 'update_user';
      v_meta := jsonb_build_object('full_name', NEW.full_name);
      IF OLD.role IS DISTINCT FROM NEW.role THEN
        v_meta := v_meta || jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role);
      END IF;
      IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
        v_meta := v_meta || jsonb_build_object('is_active', NEW.is_active);
      END IF;
      IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
        v_meta := v_meta || jsonb_build_object('old_company_id', OLD.company_id, 'new_company_id', NEW.company_id);
      END IF;
      INSERT INTO public.activity_logs (action, actor_id, target_type, target_id, company_id, metadata)
      VALUES (v_action, auth.uid(), 'user', NEW.id, NEW.company_id, v_meta);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_profile_changes
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_changes();

-- Log company changes (create + update)
CREATE OR REPLACE FUNCTION public.log_company_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action TEXT;
  v_meta JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create_company';
    v_meta := jsonb_build_object('name', NEW.name, 'plan', NEW.plan, 'slug', NEW.slug);
    INSERT INTO public.activity_logs (action, actor_id, target_type, target_id, company_id, metadata)
    VALUES (v_action, auth.uid(), 'company', NEW.id, NEW.id, v_meta);

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active IS DISTINCT FROM NEW.is_active
       OR OLD.plan IS DISTINCT FROM NEW.plan
       OR OLD.max_users IS DISTINCT FROM NEW.max_users
       OR OLD.name IS DISTINCT FROM NEW.name
       OR OLD.display_name IS DISTINCT FROM NEW.display_name
    THEN
      v_action := 'update_company';
      v_meta := jsonb_build_object('name', COALESCE(NEW.display_name, NEW.name));
      IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
        v_meta := v_meta || jsonb_build_object('is_active', NEW.is_active);
      END IF;
      IF OLD.plan IS DISTINCT FROM NEW.plan THEN
        v_meta := v_meta || jsonb_build_object('old_plan', OLD.plan, 'new_plan', NEW.plan);
      END IF;
      IF OLD.max_users IS DISTINCT FROM NEW.max_users THEN
        v_meta := v_meta || jsonb_build_object('old_max_users', OLD.max_users, 'new_max_users', NEW.max_users);
      END IF;
      INSERT INTO public.activity_logs (action, actor_id, target_type, target_id, company_id, metadata)
      VALUES (v_action, auth.uid(), 'company', NEW.id, NEW.id, v_meta);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_company_changes
  AFTER INSERT OR UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.log_company_changes();
