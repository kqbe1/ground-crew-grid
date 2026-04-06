
-- Allow admin/secretariat to upload files to intervention-photos bucket
CREATE POLICY "Admin can upload to intervention-photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'intervention-photos'
  AND public.is_admin_or_secretariat()
);

-- Allow admin/secretariat to overwrite files (upsert)
CREATE POLICY "Admin can update intervention-photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'intervention-photos'
  AND public.is_admin_or_secretariat()
);

-- Allow authenticated users to read from intervention-photos (for signed URLs)
CREATE POLICY "Authenticated can read intervention-photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'intervention-photos');

-- Same policies for intervention-signatures
CREATE POLICY "Admin can upload to intervention-signatures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'intervention-signatures'
  AND (public.is_admin_or_secretariat() OR public.is_ouvrier())
);

CREATE POLICY "Authenticated can read intervention-signatures"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'intervention-signatures');
