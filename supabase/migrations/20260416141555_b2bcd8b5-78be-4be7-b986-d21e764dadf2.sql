
-- 1. Helper function to check can_create_devis flag
CREATE OR REPLACE FUNCTION public.can_create_devis_db()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT can_create_devis FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;

-- 2. Tighten quotes INSERT policy
DROP POLICY IF EXISTS "company_insert_quotes" ON public.quotes;
CREATE POLICY "company_insert_quotes" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND (
      public.is_admin_or_bureau()
      OR (created_by = auth.uid() AND public.can_create_devis_db())
    )
  );

-- 3. Tighten quote-assets storage INSERT policy
DROP POLICY IF EXISTS "company_insert_quote_assets" ON storage.objects;
CREATE POLICY "company_insert_quote_assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      public.is_admin_or_bureau()
      OR public.can_create_devis_db()
    )
  );

-- 4. Prevent admin self-escalation in user_roles
DROP POLICY IF EXISTS "admin_manage_roles" ON public.user_roles;
CREATE POLICY "admin_manage_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    is_admin()
    AND user_id <> auth.uid()
    AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = user_roles.user_id
        AND profiles.company_id = get_my_company_id()
    )
  )
  WITH CHECK (
    is_admin()
    AND user_id <> auth.uid()
    AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = user_roles.user_id
        AND profiles.company_id = get_my_company_id()
    )
  );
