-- RLS for the private fiche-pdfs bucket (files stored under <company_id>/...)
CREATE POLICY "company_insert_fiche_pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fiche-pdfs'
  AND (
    (storage.foldername(name))[1] = (private.get_my_company_id())::text
    OR private.is_super_admin()
  )
);

CREATE POLICY "company_select_fiche_pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'fiche-pdfs'
  AND (
    (storage.foldername(name))[1] = (private.get_my_company_id())::text
    OR private.is_super_admin()
  )
);

CREATE POLICY "company_delete_fiche_pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'fiche-pdfs'
  AND (
    (private.is_admin_or_bureau() AND (storage.foldername(name))[1] = (private.get_my_company_id())::text)
    OR private.is_super_admin()
  )
);