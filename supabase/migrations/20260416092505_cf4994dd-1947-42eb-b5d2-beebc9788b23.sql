
-- Enums
CREATE TYPE public.quote_status AS ENUM ('en_attente', 'dossier_en_cours', 'en_commande', 'sav', 'cloture');
CREATE TYPE public.installation_type AS ENUM ('chaudiere', 'climatisation', 'vmc', 'salle_de_bain', 'autre');

-- Quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  status public.quote_status NOT NULL DEFAULT 'en_attente',
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_postal_code TEXT,
  client_city TEXT,
  client_phone TEXT,
  client_email TEXT,
  billing_same_as_intervention BOOLEAN NOT NULL DEFAULT true,
  billing_address TEXT,
  billing_postal_code TEXT,
  billing_city TEXT,
  installation_type public.installation_type NOT NULL DEFAULT 'autre',
  rooms_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  plan_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  existing_installation_remove BOOLEAN NOT NULL DEFAULT false,
  existing_installation_complete BOOLEAN NOT NULL DEFAULT false,
  work_description TEXT,
  checklist_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  voice_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_comments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_quotes_company_id ON public.quotes(company_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_created_by ON public.quotes(created_by);

-- Triggers
CREATE TRIGGER set_quotes_company_id
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id();

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_all_quotes" ON public.quotes
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "company_select_quotes" ON public.quotes
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND (public.is_admin_or_bureau() OR created_by = auth.uid())
  );

CREATE POLICY "company_insert_quotes" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND (public.is_admin_or_bureau() OR created_by = auth.uid())
  );

CREATE POLICY "company_update_quotes" ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND public.is_admin_or_bureau()
  );

CREATE POLICY "company_delete_quotes" ON public.quotes
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND public.is_admin_or_bureau()
  );

-- Add can_create_devis to profiles
ALTER TABLE public.profiles ADD COLUMN can_create_devis BOOLEAN NOT NULL DEFAULT false;

-- Storage bucket for quote assets
INSERT INTO storage.buckets (id, name, public) VALUES ('quote-assets', 'quote-assets', false);

-- Storage RLS for quote-assets
CREATE POLICY "company_select_quote_assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'quote-assets' AND public.storage_file_belongs_to_my_company(name));

CREATE POLICY "company_insert_quote_assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quote-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "company_delete_quote_assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'quote-assets' AND (public.storage_file_belongs_to_my_company(name) AND public.is_admin_or_bureau() OR (storage.foldername(name))[1] = auth.uid()::text));

-- Enable realtime for quotes
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
