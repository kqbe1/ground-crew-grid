
-- Scope storage delete policies to company for intervention photos/signatures
DROP POLICY IF EXISTS "Owner or admin can delete photos" ON storage.objects;
CREATE POLICY "Owner or admin can delete photos" ON storage.objects FOR DELETE USING (
  bucket_id = 'intervention-photos'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR (private.is_admin_or_bureau() AND private.storage_file_belongs_to_my_company(name))
    OR private.is_super_admin()
  )
);

DROP POLICY IF EXISTS "Owner or admin can delete signatures" ON storage.objects;
CREATE POLICY "Owner or admin can delete signatures" ON storage.objects FOR DELETE USING (
  bucket_id = 'intervention-signatures'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR (private.is_admin_or_bureau() AND private.storage_file_belongs_to_my_company(name))
    OR private.is_super_admin()
  )
);

-- Restrict parts_orders updates to admin/bureau (or super_admin); workers cannot mutate orders
DROP POLICY IF EXISTS company_update_orders ON public.parts_orders;
CREATE POLICY company_update_orders ON public.parts_orders FOR UPDATE
USING (
  (company_id = private.get_my_company_id() AND private.is_admin_or_bureau())
  OR private.is_super_admin()
)
WITH CHECK (
  (company_id = private.get_my_company_id() AND private.is_admin_or_bureau())
  OR private.is_super_admin()
);
