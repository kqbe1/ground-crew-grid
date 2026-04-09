
-- Super admin can update any profile
CREATE POLICY "sa_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin());

-- Admin can update profiles within their company
CREATE POLICY "admin_update_company_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND company_id = public.get_my_company_id()
    AND id != auth.uid()
  );

-- Super admin can manage companies (insert, update, delete)
CREATE POLICY "sa_insert_companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "sa_update_companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "sa_delete_companies" ON public.companies
  FOR DELETE TO authenticated
  USING (public.is_super_admin());
