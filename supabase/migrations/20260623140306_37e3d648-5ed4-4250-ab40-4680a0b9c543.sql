DROP POLICY IF EXISTS "Bureau et Admin éditent toutes les fiches" ON public.intervention_sheets;

CREATE POLICY "Bureau et Admin éditent toutes les fiches"
ON public.intervention_sheets
FOR UPDATE
TO authenticated
USING (
  private.is_admin_or_secretariat()
  AND (company_id = private.get_my_company_id() OR private.is_super_admin())
)
WITH CHECK (
  private.is_admin_or_secretariat()
  AND (company_id = private.get_my_company_id() OR private.is_super_admin())
);

CREATE POLICY "company_delete_pdf"
ON public.pdf_settings
FOR DELETE
TO authenticated
USING (
  (company_id = private.get_my_company_id() AND private.is_admin_or_secretariat())
  OR private.is_super_admin()
);