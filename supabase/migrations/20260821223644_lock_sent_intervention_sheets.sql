-- Restore legitimate bureau/admin updates on intervention sheets.
-- Workers remain restricted by their dedicated draft-only policy.

DROP POLICY IF EXISTS "admin_bureau_update_sheets"
ON public.intervention_sheets;

CREATE POLICY "admin_bureau_update_sheets"
ON public.intervention_sheets
FOR UPDATE
TO authenticated
USING (
  company_id = private.get_my_company_id()
  AND private.is_admin_or_bureau()
)
WITH CHECK (
  company_id = private.get_my_company_id()
  AND private.is_admin_or_bureau()
);


-- Once a sheet has been sent to the client, its contractual/business
-- contents must no longer be alterable.
-- Internal bureau comments and archive metadata remain editable.

CREATE OR REPLACE FUNCTION public.protect_sent_intervention_sheet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Backend operations and super-admin retain emergency access.
  IF auth.uid() IS NULL OR private.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.sent_to_client = true THEN

    -- A sent sheet can never be marked as unsent.
    IF NEW.sent_to_client IS DISTINCT FROM OLD.sent_to_client THEN
      RAISE EXCEPTION
        'Fiche verrouillée : une fiche envoyée au client ne peut plus être remise en brouillon.';
    END IF;

    -- Compare the whole business record while excluding only
    -- administrative metadata that is intentionally still editable.
    IF (
      to_jsonb(NEW)
        - ARRAY[
            'internal_comment',
            'bureau_archived',
            'bureau_archived_at',
            'bureau_archived_by',
            'updated_at'
          ]::text[]
    ) IS DISTINCT FROM (
      to_jsonb(OLD)
        - ARRAY[
            'internal_comment',
            'bureau_archived',
            'bureau_archived_at',
            'bureau_archived_by',
            'updated_at'
          ]::text[]
    ) THEN
      RAISE EXCEPTION
        'Fiche verrouillée : son contenu ne peut plus être modifié après envoi au client.';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL
ON FUNCTION public.protect_sent_intervention_sheet()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_sent_intervention_sheet
ON public.intervention_sheets;

CREATE TRIGGER trg_protect_sent_intervention_sheet
BEFORE UPDATE ON public.intervention_sheets
FOR EACH ROW
EXECUTE FUNCTION public.protect_sent_intervention_sheet();