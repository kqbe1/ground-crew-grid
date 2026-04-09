
CREATE POLICY "sa_select_companies" ON public.companies
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
