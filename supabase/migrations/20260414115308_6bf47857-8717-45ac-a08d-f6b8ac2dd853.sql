
CREATE POLICY "company_admin_select_logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    (company_id = get_my_company_id()) AND is_admin_or_bureau()
  );
