
-- Allow ouvriers to upload photos to intervention-photos bucket (in their own folder)
CREATE POLICY "Ouvrier can upload to intervention-photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'intervention-photos'
  AND public.is_ouvrier()
  AND (storage.foldername(name))[1] = auth.uid()::text
);
