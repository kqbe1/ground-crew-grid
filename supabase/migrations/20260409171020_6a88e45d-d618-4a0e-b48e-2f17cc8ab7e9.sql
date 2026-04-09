
-- Helper function: check if a file's owner (first folder segment = user_id) belongs to the caller's company
CREATE OR REPLACE FUNCTION public.storage_file_belongs_to_my_company(file_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = ((storage.foldername(file_name))[1])::uuid
      AND company_id = public.get_my_company_id()
  )
$$;

-- Fix intervention-photos SELECT: add company scope for admin/bureau
DROP POLICY IF EXISTS "Company members can view intervention photos" ON storage.objects;
CREATE POLICY "Company members can view intervention photos" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'intervention-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (is_admin_or_bureau() AND public.storage_file_belongs_to_my_company(name))
    OR is_super_admin()
  )
);

-- Fix intervention-signatures SELECT: add company scope for admin/bureau
DROP POLICY IF EXISTS "Company members can view signatures" ON storage.objects;
CREATE POLICY "Company members can view signatures" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'intervention-signatures'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (is_admin_or_bureau() AND public.storage_file_belongs_to_my_company(name))
    OR is_super_admin()
  )
);
