ALTER TABLE public.intervention_sheets
  ADD COLUMN IF NOT EXISTS work_status_details text[],
  ADD COLUMN IF NOT EXISTS work_status_notes jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.parts_orders ADD COLUMN IF NOT EXISTS photos text[];

DROP POLICY IF EXISTS "Ouvrier can update own sheets" ON public.intervention_sheets;
DROP POLICY IF EXISTS "Update sheets" ON public.intervention_sheets;
DROP POLICY IF EXISTS "Ouvrier édite ses brouillons" ON public.intervention_sheets;
DROP POLICY IF EXISTS "Bureau et Admin éditent toutes les fiches" ON public.intervention_sheets;

CREATE POLICY "Ouvrier édite ses brouillons"
  ON public.intervention_sheets
  FOR UPDATE
  TO authenticated
  USING (private.is_ouvrier() AND worker_id = auth.uid() AND is_draft = true)
  WITH CHECK (private.is_ouvrier() AND worker_id = auth.uid() AND is_draft = true);

CREATE POLICY "Bureau et Admin éditent toutes les fiches"
  ON public.intervention_sheets
  FOR UPDATE
  TO authenticated
  USING (private.is_admin_or_secretariat())
  WITH CHECK (private.is_admin_or_secretariat());
