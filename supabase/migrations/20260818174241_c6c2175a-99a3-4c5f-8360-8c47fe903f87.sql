-- 1. Deactivated users lose access to business data (role/company resolve to NULL)
CREATE OR REPLACE FUNCTION private.get_my_role()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true $$;

CREATE OR REPLACE FUNCTION private.get_my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_active = true $$;

-- 2. intervention_sheets: ouvrier can only edit his own DRAFT sheets
DROP POLICY IF EXISTS "company_update_sheets" ON public.intervention_sheets;
DROP POLICY IF EXISTS "Ouvrier édite ses brouillons" ON public.intervention_sheets;

CREATE POLICY "Ouvrier édite ses brouillons"
ON public.intervention_sheets FOR UPDATE TO authenticated
USING (
  private.is_ouvrier()
  AND worker_id = auth.uid()
  AND company_id = private.get_my_company_id()
  AND is_draft = true
  AND sent_to_client = false
)
WITH CHECK (
  private.is_ouvrier()
  AND worker_id = auth.uid()
  AND company_id = private.get_my_company_id()
  AND sent_to_client = false
);

CREATE POLICY "sa_update_sheets"
ON public.intervention_sheets FOR UPDATE TO authenticated
USING (private.is_super_admin()) WITH CHECK (private.is_super_admin());
