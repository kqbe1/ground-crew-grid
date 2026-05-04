
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY full_name) AS rn
  FROM public.profiles
)
UPDATE public.profiles p
SET display_order = ranked.rn
FROM ranked
WHERE ranked.id = p.id;

CREATE POLICY "bureau_admin_update_own_display_order" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() AND public.is_admin_or_bureau())
WITH CHECK (id = auth.uid() AND public.is_admin_or_bureau());
