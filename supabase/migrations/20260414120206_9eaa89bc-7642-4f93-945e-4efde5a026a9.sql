
DROP POLICY IF EXISTS "Scoped read company assets" ON storage.objects;

CREATE POLICY "Scoped read company assets" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'company-assets'
    AND (
      (storage.foldername(name))[1] = get_my_company_id()::text
      OR is_super_admin()
    )
  );
