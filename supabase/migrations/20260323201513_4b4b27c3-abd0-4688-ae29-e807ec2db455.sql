
-- Make storage buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('intervention-photos', 'intervention-signatures');

-- Add RLS policies for storage so authenticated users can upload and read their own files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('intervention-photos', 'intervention-signatures'));

CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id IN ('intervention-photos', 'intervention-signatures'));
