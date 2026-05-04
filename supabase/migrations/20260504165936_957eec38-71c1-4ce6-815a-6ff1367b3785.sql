
-- 1) Fix profiles own_update to also lock can_create_devis & worker_level
DROP POLICY IF EXISTS own_update ON public.profiles;

CREATE POLICY own_update ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND NOT (role IS DISTINCT FROM (SELECT r.role FROM public.get_my_profile_protected() r))
  AND NOT (company_id IS DISTINCT FROM (SELECT r.company_id FROM public.get_my_profile_protected() r))
  AND NOT (is_active IS DISTINCT FROM (SELECT r.is_active FROM public.get_my_profile_protected() r))
  AND NOT (can_create_devis IS DISTINCT FROM (SELECT p.can_create_devis FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (worker_level IS DISTINCT FROM (SELECT p.worker_level FROM public.profiles p WHERE p.id = auth.uid()))
);

-- 2) Restrict sensitive company columns from non-admin members via column-level privileges
REVOKE SELECT ON public.companies FROM authenticated;
GRANT SELECT (
  id, name, display_name, slug, logo_url, primary_color, secondary_color,
  address, is_active, created_at, updated_at
) ON public.companies TO authenticated;

-- Admins/bureau & super admin still need full access; grant via separate policy path
-- Create a SECURITY DEFINER view-like function for admins to read full company details
CREATE OR REPLACE FUNCTION public.get_my_company_full()
RETURNS SETOF public.companies
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.companies
  WHERE (id = public.get_my_company_id() AND public.is_admin_or_bureau())
     OR public.is_super_admin()
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_company_full() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_company_full() TO authenticated;

-- 3) Lock down SECURITY DEFINER helpers from anon (still callable by authenticated for RLS)
REVOKE EXECUTE ON FUNCTION public.get_my_profile_protected() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_company_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_bureau() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_ouvrier() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_bureau() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_secretariat() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_create_devis_db() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.storage_file_belongs_to_my_company(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_clients_safe() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_activity(text, uuid, text, uuid, uuid, jsonb) FROM PUBLIC, anon;
