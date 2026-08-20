-- Réception réelle des fiches côté Bureau
-- Une fiche est "reçue" au moment où elle cesse d'être un brouillon (finalisation),
-- et non à sa date de création ni à la date d'intervention.

ALTER TABLE public.intervention_sheets
  ADD COLUMN IF NOT EXISTS bureau_received_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_bureau_received_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_draft = false AND NEW.bureau_received_at IS NULL THEN
    NEW.bureau_received_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_bureau_received_at ON public.intervention_sheets;
CREATE TRIGGER trg_set_bureau_received_at
  BEFORE INSERT OR UPDATE ON public.intervention_sheets
  FOR EACH ROW EXECUTE FUNCTION public.set_bureau_received_at();

-- Backfill : fiches déjà finalisées
UPDATE public.intervention_sheets
SET bureau_received_at = COALESCE(updated_at, created_at)
WHERE is_draft = false AND bureau_received_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_intervention_sheets_bureau_received_at
  ON public.intervention_sheets (bureau_received_at DESC);
