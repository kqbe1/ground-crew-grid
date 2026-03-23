
-- Trigger to prevent non-admin users from modifying privileged profile columns
CREATE OR REPLACE FUNCTION public.restrict_user_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.worker_level := OLD.worker_level;
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_user_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_user_profile_update();
