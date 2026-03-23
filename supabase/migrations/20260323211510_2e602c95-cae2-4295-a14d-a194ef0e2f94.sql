-- Make buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('intervention-photos', 'intervention-signatures');

-- Drop any remaining public SELECT policies on storage
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname ILIKE '%public can view%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END;
$$;