-- 1. Server-side enforcement of the AGDELETENOW confirmation code for sheet deletion.
CREATE OR REPLACE FUNCTION public.delete_intervention_sheet(p_sheet_id uuid, p_confirmation_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF upper(coalesce(btrim(p_confirmation_code), '')) <> 'AGDELETENOW' THEN
    RAISE EXCEPTION 'Code de confirmation incorrect';
  END IF;

  SELECT company_id INTO v_company FROM public.intervention_sheets WHERE id = p_sheet_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Fiche introuvable';
  END IF;

  IF NOT (
    private.is_super_admin()
    OR (private.is_admin_or_bureau() AND v_company = private.get_my_company_id())
  ) THEN
    RAISE EXCEPTION 'Droits insuffisants pour supprimer cette fiche';
  END IF;

  DELETE FROM public.intervention_sheets WHERE id = p_sheet_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_intervention_sheet(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_intervention_sheet(uuid, text) TO authenticated;

-- 2. Direct DELETE on the table is no longer possible: the RPC above is the only path.
DROP POLICY IF EXISTS "company_delete_sheets" ON public.intervention_sheets;
REVOKE DELETE ON public.intervention_sheets FROM authenticated, anon;