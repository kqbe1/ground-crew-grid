
CREATE POLICY "company_update_quote_assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'quote-assets'
  AND (
    (public.is_admin_or_bureau() AND public.storage_file_belongs_to_my_company(name))
    OR public.is_super_admin()
  )
);
