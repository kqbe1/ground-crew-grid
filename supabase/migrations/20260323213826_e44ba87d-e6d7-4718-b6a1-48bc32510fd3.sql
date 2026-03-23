
-- Step 2: Create is_super_admin function and update RLS policies

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
$$;

-- Update user_roles RLS policies
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
CREATE POLICY "Role management insert" ON public.user_roles
FOR INSERT TO public
WITH CHECK (
  is_super_admin() 
  OR (is_admin() AND (role NOT IN ('admin', 'super_admin')))
);

DROP POLICY IF EXISTS "Admin can update roles" ON public.user_roles;
CREATE POLICY "Role management update" ON public.user_roles
FOR UPDATE TO public
USING (
  is_super_admin() 
  OR (is_admin() AND (role NOT IN ('admin', 'super_admin')))
);

DROP POLICY IF EXISTS "Admin can delete roles" ON public.user_roles;
CREATE POLICY "Role management delete" ON public.user_roles
FOR DELETE TO public
USING (
  is_super_admin() 
  OR (is_admin() AND (role NOT IN ('admin', 'super_admin')))
);

DROP POLICY IF EXISTS "Admin can view all roles" ON public.user_roles;
CREATE POLICY "Role viewing" ON public.user_roles
FOR SELECT TO public
USING (is_admin() OR is_super_admin());

-- Update profiles policies so admin can't deactivate other admins (only super_admin can)
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile" ON public.profiles
FOR UPDATE TO public
USING (is_super_admin() OR is_admin());

-- Restrict profile update trigger: admin cannot change is_active for admins/super_admins
CREATE OR REPLACE FUNCTION public.restrict_user_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super admin can do everything
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Admin: can change worker_level and is_active, but NOT for other admins/super_admins
  IF public.is_admin() THEN
    -- Check if target user is admin or super_admin
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = OLD.id 
      AND role IN ('admin', 'super_admin')
    ) AND OLD.id != auth.uid() THEN
      -- Cannot modify another admin's active status or level
      NEW.is_active := OLD.is_active;
      NEW.worker_level := OLD.worker_level;
    END IF;
    -- Admin cannot change their own is_active
    IF OLD.id = auth.uid() THEN
      NEW.is_active := OLD.is_active;
    END IF;
    RETURN NEW;
  END IF;

  -- Non-admin: cannot change worker_level or is_active
  NEW.worker_level := OLD.worker_level;
  NEW.is_active := OLD.is_active;
  RETURN NEW;
END;
$$;
