
-- 1. Fix privilege escalation: Add WITH CHECK to own_update policy on profiles
-- Prevents users from modifying their own role, company_id, or is_active
DROP POLICY IF EXISTS "own_update" ON public.profiles;
CREATE POLICY "own_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND company_id IS NOT DISTINCT FROM (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active IS NOT DISTINCT FROM (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 2. Tighten activity_logs INSERT policy to restrict company_id
DROP POLICY IF EXISTS "authenticated_insert_own_login_log" ON public.activity_logs;
CREATE POLICY "authenticated_insert_own_login_log" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    action = 'login'
    AND actor_id = auth.uid()
    AND (company_id IS NULL OR company_id = get_my_company_id())
  );

-- 3. Restrict public bucket listing for company-assets
-- Drop the broad SELECT policy and replace with scoped one
DROP POLICY IF EXISTS "Public can view company assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view company assets" ON storage.objects;
CREATE POLICY "Scoped read company assets" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'company-assets'
    AND (
      storage_file_belongs_to_my_company(name)
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    )
  );
