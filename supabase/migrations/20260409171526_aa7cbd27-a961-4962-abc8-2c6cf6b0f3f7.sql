
-- Fix company-assets: scope writes to own company folder
DROP POLICY IF EXISTS "Company admins can upload assets" ON storage.objects;
CREATE POLICY "Company admins can upload assets" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND (
    (is_admin_or_bureau() AND (storage.foldername(name))[1] = get_my_company_id()::text)
    OR is_super_admin()
  )
);

DROP POLICY IF EXISTS "Company admins can update assets" ON storage.objects;
CREATE POLICY "Company admins can update assets" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND (
    (is_admin_or_bureau() AND (storage.foldername(name))[1] = get_my_company_id()::text)
    OR is_super_admin()
  )
);

DROP POLICY IF EXISTS "Company admins can delete assets" ON storage.objects;
CREATE POLICY "Company admins can delete assets" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND (
    (is_admin_or_bureau() AND (storage.foldername(name))[1] = get_my_company_id()::text)
    OR is_super_admin()
  )
);
