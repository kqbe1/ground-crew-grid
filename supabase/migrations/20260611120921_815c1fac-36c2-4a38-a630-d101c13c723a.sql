
-- Per-document PDF configuration: extend pdf_settings to one row per (company_id, document_type)

ALTER TABLE public.pdf_settings
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'fiche_intervention',
  ADD COLUMN IF NOT EXISTS text_blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Replace the non-unique index with a uniqueness constraint per (company, doc type)
DROP INDEX IF EXISTS idx_pdf_settings_company;
CREATE UNIQUE INDEX IF NOT EXISTS pdf_settings_company_doctype_uniq
  ON public.pdf_settings(company_id, document_type);

-- Make sure every company has rows for fiche_entretien and devis, cloning the existing fiche_intervention row.
INSERT INTO public.pdf_settings (
  company_id, document_type,
  company_name, company_address, company_phone, company_email, company_website, company_vat,
  logo_url, document_title, primary_color,
  show_horaires, show_description, show_checklist, show_client_state,
  show_photos_before, show_photos_after, show_signature,
  show_worker_info, show_client_info, show_intervention_type,
  footer_text, text_blocks
)
SELECT
  ps.company_id, t.dt,
  ps.company_name, ps.company_address, ps.company_phone, ps.company_email, ps.company_website, ps.company_vat,
  ps.logo_url,
  CASE t.dt
    WHEN 'fiche_entretien' THEN 'Fiche d''entretien'
    WHEN 'devis' THEN 'Devis'
    ELSE ps.document_title
  END,
  ps.primary_color,
  ps.show_horaires, ps.show_description, ps.show_checklist, ps.show_client_state,
  ps.show_photos_before, ps.show_photos_after, ps.show_signature,
  ps.show_worker_info, ps.show_client_info, ps.show_intervention_type,
  ps.footer_text, '[]'::jsonb
FROM public.pdf_settings ps
CROSS JOIN (VALUES ('fiche_entretien'), ('devis')) AS t(dt)
WHERE ps.document_type = 'fiche_intervention'
ON CONFLICT (company_id, document_type) DO NOTHING;
