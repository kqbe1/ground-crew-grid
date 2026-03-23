
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view signatures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;

CREATE POLICY "Users can read own storage files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('intervention-photos','intervention-signatures')
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_secretariat()
  )
);

CREATE POLICY "Users can upload own storage files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('intervention-photos','intervention-signatures')
  AND (storage.foldername(name))[1] = auth.uid()::text
);
