DROP POLICY IF EXISTS company_select_quote_assets ON storage.objects;
CREATE POLICY company_select_quote_assets ON storage.objects
FOR SELECT
USING (
  bucket_id = 'quote-assets'
  AND private.storage_file_belongs_to_my_company(name)
  AND (
    private.is_admin_or_bureau()
    OR private.is_super_admin()
    OR private.can_create_devis_db()
    OR (storage.foldername(name))[1] = (auth.uid())::text
  )
);