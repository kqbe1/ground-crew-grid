ALTER TABLE public.intervention_sheets
  ADD COLUMN IF NOT EXISTS bureau_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bureau_archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS bureau_archived_by uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_intervention_sheets_bureau_archived
  ON public.intervention_sheets (company_id, bureau_archived);