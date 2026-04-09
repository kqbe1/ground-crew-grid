
-- 1. Fix parts_orders INSERT: enforce requested_by = auth.uid() for non-admin
DROP POLICY IF EXISTS "company_insert_orders" ON public.parts_orders;
CREATE POLICY "company_insert_orders" ON public.parts_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = get_my_company_id() AND requested_by = auth.uid())
    OR is_admin_or_bureau()
    OR is_super_admin()
  );

-- 2. Scope admin_view_roles to same company
DROP POLICY IF EXISTS "admin_view_roles" ON public.user_roles;
CREATE POLICY "admin_view_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    is_admin_or_secretariat()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = user_roles.user_id
        AND profiles.company_id = get_my_company_id()
    )
  );

-- 3. Add UPDATE policies for intervention-photos and intervention-signatures
CREATE POLICY "Owner or company admin can update intervention photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'intervention-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (is_admin_or_bureau() AND public.storage_file_belongs_to_my_company(name))
      OR is_super_admin()
    )
  );

CREATE POLICY "Owner or company admin can update intervention signatures" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'intervention-signatures'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (is_admin_or_bureau() AND public.storage_file_belongs_to_my_company(name))
      OR is_super_admin()
    )
  );
