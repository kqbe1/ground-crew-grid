
CREATE TABLE public.email_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL CHECK (template_key IN ('fiche-intervention','rappel-entretien')),
  subject TEXT NOT NULL,
  intro_text TEXT NOT NULL,
  footer_text TEXT NOT NULL DEFAULT 'Merci de votre confiance,\nAG Chauffage',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT 'info@agchauffage.be',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, template_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_settings TO authenticated;
GRANT ALL ON public.email_settings TO service_role;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read email_settings"
  ON public.email_settings FOR SELECT TO authenticated
  USING (company_id = private.get_my_company_id() OR private.is_super_admin());

CREATE POLICY "Admin/Bureau insert email_settings"
  ON public.email_settings FOR INSERT TO authenticated
  WITH CHECK (
    (private.is_admin_or_bureau() AND company_id = private.get_my_company_id())
    OR private.is_super_admin()
  );

CREATE POLICY "Admin/Bureau update email_settings"
  ON public.email_settings FOR UPDATE TO authenticated
  USING (
    (private.is_admin_or_bureau() AND company_id = private.get_my_company_id())
    OR private.is_super_admin()
  )
  WITH CHECK (
    (private.is_admin_or_bureau() AND company_id = private.get_my_company_id())
    OR private.is_super_admin()
  );

CREATE POLICY "Admin/Bureau delete email_settings"
  ON public.email_settings FOR DELETE TO authenticated
  USING (
    (private.is_admin_or_bureau() AND company_id = private.get_my_company_id())
    OR private.is_super_admin()
  );

CREATE TRIGGER set_company_id_email_settings
  BEFORE INSERT ON public.email_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

CREATE TRIGGER update_email_settings_updated_at
  BEFORE UPDATE ON public.email_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
