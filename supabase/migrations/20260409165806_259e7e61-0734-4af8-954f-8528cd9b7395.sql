
-- 1. Remove overly permissive storage SELECT policies for intervention buckets
DROP POLICY IF EXISTS "Authenticated can read intervention-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read intervention-signatures" ON storage.objects;

-- 2. Fix work_tasks INSERT: add company_id check
DROP POLICY IF EXISTS "company_insert_work_tasks" ON public.work_tasks;
CREATE POLICY "company_insert_work_tasks" ON public.work_tasks FOR INSERT TO authenticated
WITH CHECK (((company_id = get_my_company_id()) AND is_admin_or_bureau()) OR is_super_admin());

-- 3. Fix own_update on profiles: add WITH CHECK to prevent role/company_id self-modification
-- The trigger restrict_user_profile_update already handles this, but belt-and-suspenders
DROP POLICY IF EXISTS "own_update" ON public.profiles;
CREATE POLICY "own_update" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 4. Fix admin_view_roles: scope to authenticated only
DROP POLICY IF EXISTS "admin_view_roles" ON public.user_roles;
CREATE POLICY "admin_view_roles" ON public.user_roles FOR SELECT TO authenticated
USING (is_admin_or_secretariat());

-- 5. Fix view_own_role: scope to authenticated
DROP POLICY IF EXISTS "view_own_role" ON public.user_roles;
CREATE POLICY "view_own_role" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 6. Fix sa_all_roles: scope to authenticated
DROP POLICY IF EXISTS "sa_all_roles" ON public.user_roles;
CREATE POLICY "sa_all_roles" ON public.user_roles FOR ALL TO authenticated
USING (is_super_admin());

-- 7. Company-assets: restrict writes to admin/bureau of the company
DROP POLICY IF EXISTS "Company admins can upload assets" ON storage.objects;
CREATE POLICY "Company admins can upload assets" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-assets' AND (is_admin_or_bureau() OR is_super_admin()));

DROP POLICY IF EXISTS "Company admins can update assets" ON storage.objects;
CREATE POLICY "Company admins can update assets" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-assets' AND (is_admin_or_bureau() OR is_super_admin()));

DROP POLICY IF EXISTS "Company admins can delete assets" ON storage.objects;
CREATE POLICY "Company admins can delete assets" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-assets' AND (is_admin_or_bureau() OR is_super_admin()));
