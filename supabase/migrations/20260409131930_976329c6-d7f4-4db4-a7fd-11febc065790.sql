
-- Sync user_roles when profiles.role is set or changed
CREATE OR REPLACE FUNCTION public.sync_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, NEW.role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Remove old role if changed
    IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role AND OLD.role IS NOT NULL THEN
      DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_user_role_trigger
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_role();
