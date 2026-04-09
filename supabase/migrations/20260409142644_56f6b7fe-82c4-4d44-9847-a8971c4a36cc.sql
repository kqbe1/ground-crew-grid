
-- 1. Convert data
UPDATE public.profiles SET role = 'bureau' WHERE role = 'secretariat';
UPDATE public.user_roles SET role = 'bureau' WHERE role = 'secretariat';

-- 2. Drop trigger
DROP TRIGGER IF EXISTS sync_user_role_trigger ON public.profiles;

-- 3. Drop RLS policies on user_roles
DROP POLICY IF EXISTS "admin_manage_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_view_roles" ON public.user_roles;
DROP POLICY IF EXISTS "sa_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "view_own_role" ON public.user_roles;

-- 4. Rename old enum
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('admin', 'ouvrier', 'super_admin', 'bureau');

-- 5. Alter columns
ALTER TABLE public.profiles 
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role,
  ALTER COLUMN role SET DEFAULT 'ouvrier'::public.app_role;

ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;

-- 6. Drop dependent functions WITH CASCADE (will also drop storage policies referencing them)
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role_old) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_bureau() CASCADE;
DROP FUNCTION IF EXISTS public.is_ouvrier() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_or_secretariat() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_or_bureau() CASCADE;
DROP FUNCTION IF EXISTS public.is_secretariat() CASCADE;

DROP TYPE public.app_role_old;

-- 7. Recreate all functions
CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.get_my_role() = 'admin' $$;

CREATE OR REPLACE FUNCTION public.is_bureau()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.get_my_role() = 'bureau' $$;

CREATE OR REPLACE FUNCTION public.is_ouvrier()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.get_my_role() = 'ouvrier' $$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.get_my_role() = 'super_admin' $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_secretariat()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.get_my_role() IN ('admin', 'bureau') $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_bureau()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.get_my_role() IN ('admin', 'bureau') $$;

-- 8. Recreate sync_user_role + trigger
CREATE OR REPLACE FUNCTION public.sync_user_role()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, NEW.role)
    ON CONFLICT (user_id, role) DO NOTHING;
    IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role AND OLD.role IS NOT NULL THEN
      DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_user_role_trigger
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role();

-- 9. Recreate user_roles policies
CREATE POLICY "admin_manage_roles" ON public.user_roles
  FOR ALL TO public
  USING (is_admin_or_secretariat() AND (role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])))
  WITH CHECK (is_admin_or_secretariat() AND (role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])));

CREATE POLICY "admin_view_roles" ON public.user_roles
  FOR SELECT TO public USING (is_admin_or_secretariat());

CREATE POLICY "sa_all_roles" ON public.user_roles
  FOR ALL TO public USING (is_super_admin());

CREATE POLICY "view_own_role" ON public.user_roles
  FOR SELECT TO public USING (user_id = auth.uid());

-- 10. Recreate other functions
CREATE OR REPLACE FUNCTION public.restrict_user_profile_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  IF public.is_admin() OR public.is_bureau() THEN
    IF OLD.role IN ('admin', 'super_admin') AND OLD.id != auth.uid() THEN
      NEW.is_active := OLD.is_active; NEW.worker_level := OLD.worker_level; NEW.role := OLD.role;
    END IF;
    IF OLD.id = auth.uid() THEN NEW.is_active := OLD.is_active; NEW.role := OLD.role; END IF;
    NEW.company_id := OLD.company_id;
    RETURN NEW;
  END IF;
  NEW.worker_level := OLD.worker_level; NEW.is_active := OLD.is_active;
  NEW.role := OLD.role; NEW.company_id := OLD.company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, company_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'ouvrier'),
    (NEW.raw_user_meta_data ->> 'company_id')::uuid);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_clients_safe()
 RETURNS TABLE(id uuid, name text, phone text, email text, address_intervention text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT c.id, c.name, c.phone, c.email, c.address_intervention
  FROM public.clients c
  INNER JOIN public.work_tasks wt ON wt.client_id = c.id
  WHERE wt.assigned_to = auth.uid()
    AND c.company_id = public.get_my_company_id();
$$;

CREATE OR REPLACE FUNCTION public.restrict_ouvrier_task_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_ouvrier() THEN RETURN NEW; END IF;
  NEW.memo_secretariat := OLD.memo_secretariat;
  NEW.assigned_to := OLD.assigned_to;
  NEW.second_assigned_to := OLD.second_assigned_to;
  NEW.client_id := OLD.client_id;
  NEW.client_site_id := OLD.client_site_id;
  NEW.equipment_id := OLD.equipment_id;
  NEW.created_by := OLD.created_by;
  NEW.intervention_type := OLD.intervention_type;
  NEW.title := OLD.title;
  NEW.scheduled_date := OLD.scheduled_date;
  NEW.start_time := OLD.start_time;
  NEW.duration_minutes := OLD.duration_minutes;
  NEW.template_id := OLD.template_id;
  RETURN NEW;
END;
$$;

-- 11. Recreate storage policies that were dropped by CASCADE
CREATE POLICY "Owner or admin can delete photos"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'intervention-photos' AND (
  auth.uid()::text = (storage.foldername(name))[1]
  OR public.is_admin()
  OR public.is_super_admin()
));

CREATE POLICY "Owner or admin can delete signatures"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'intervention-signatures' AND (
  auth.uid()::text = (storage.foldername(name))[1]
  OR public.is_admin()
  OR public.is_super_admin()
));
