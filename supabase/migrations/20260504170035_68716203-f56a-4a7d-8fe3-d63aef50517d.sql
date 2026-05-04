
DROP VIEW IF EXISTS public.companies_public;

-- Restaure une politique permissive de SELECT pour les membres
DROP POLICY IF EXISTS admin_view_company ON public.companies;

CREATE POLICY member_view_company ON public.companies
FOR SELECT TO authenticated
USING (id = public.get_my_company_id() OR public.is_super_admin());

-- Restreint les colonnes sensibles via GRANT au niveau colonne
REVOKE SELECT ON public.companies FROM authenticated;
GRANT SELECT (
  id, name, display_name, slug, logo_url, primary_color, secondary_color,
  address, is_active, created_at, updated_at
) ON public.companies TO authenticated;

-- Les admins/bureau/super admin lisent les champs sensibles via cette fonction
-- (déjà créée précédemment : get_my_company_full)
