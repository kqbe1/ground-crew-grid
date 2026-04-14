
DROP POLICY "admin_manage_roles" ON public.user_roles;

CREATE POLICY "admin_manage_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    is_admin()
    AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = user_roles.user_id
        AND profiles.company_id = get_my_company_id()
    )
  )
  WITH CHECK (
    is_admin()
    AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = user_roles.user_id
        AND profiles.company_id = get_my_company_id()
    )
  );
