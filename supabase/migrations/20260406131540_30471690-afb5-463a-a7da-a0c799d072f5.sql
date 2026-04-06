
CREATE TABLE public.pdf_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL DEFAULT '',
  company_address text NOT NULL DEFAULT '',
  company_phone text NOT NULL DEFAULT '',
  company_email text NOT NULL DEFAULT '',
  company_website text NOT NULL DEFAULT '',
  company_vat text NOT NULL DEFAULT '',
  logo_url text,
  document_title text NOT NULL DEFAULT 'Fiche d''intervention',
  primary_color text NOT NULL DEFAULT '#1a1a2e',
  show_horaires boolean NOT NULL DEFAULT true,
  show_description boolean NOT NULL DEFAULT true,
  show_checklist boolean NOT NULL DEFAULT true,
  show_client_state boolean NOT NULL DEFAULT true,
  show_photos_before boolean NOT NULL DEFAULT true,
  show_photos_after boolean NOT NULL DEFAULT true,
  show_signature boolean NOT NULL DEFAULT true,
  show_worker_info boolean NOT NULL DEFAULT true,
  show_client_info boolean NOT NULL DEFAULT true,
  show_intervention_type boolean NOT NULL DEFAULT true,
  footer_text text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pdf_settings"
ON public.pdf_settings FOR SELECT
USING (public.is_admin() OR public.is_super_admin());

CREATE POLICY "Admins can insert pdf_settings"
ON public.pdf_settings FOR INSERT
WITH CHECK (public.is_admin() OR public.is_super_admin());

CREATE POLICY "Admins can update pdf_settings"
ON public.pdf_settings FOR UPDATE
USING (public.is_admin() OR public.is_super_admin());

-- Seed with default row
INSERT INTO public.pdf_settings (company_name) VALUES ('');

-- Trigger for updated_at
CREATE TRIGGER update_pdf_settings_updated_at
BEFORE UPDATE ON public.pdf_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
