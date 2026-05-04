
-- Restore full SELECT on companies table
GRANT SELECT ON public.companies TO authenticated;

-- Drop the broad member view policy and restrict to admin/bureau + super admin
DROP POLICY IF EXISTS member_view_company ON public.companies;

CREATE POLICY admin_view_company ON public.companies
FOR SELECT TO authenticated
USING (
  (id = public.get_my_company_id() AND public.is_admin_or_bureau())
  OR public.is_super_admin()
);

-- Public branding view for all members (workers included)
CREATE OR REPLACE VIEW public.companies_public
WITH (security_invoker = true) AS
SELECT id, name, display_name, slug, logo_url, primary_color, secondary_color, is_active
FROM public.companies;

GRANT SELECT ON public.companies_public TO authenticated, anon;

-- Add an RLS-friendly policy via a SECURITY DEFINER wrapper isn't needed since view uses invoker.
-- Add policy so members can read only their company branding through the view's underlying table?
-- security_invoker = true means it uses caller's RLS, so we need a member policy that returns only safe columns.
-- Simpler: create a permissive SELECT policy on companies for own company, but column-restricted via the view alone is impossible.
-- Use security_invoker = false for the view so it bypasses RLS but only exposes safe columns.
DROP VIEW IF EXISTS public.companies_public;
CREATE VIEW public.companies_public
WITH (security_invoker = false) AS
SELECT id, name, display_name, slug, logo_url, primary_color, secondary_color, is_active
FROM public.companies;

GRANT SELECT ON public.companies_public TO authenticated, anon;
