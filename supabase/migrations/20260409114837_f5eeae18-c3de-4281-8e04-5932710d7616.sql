
-- =============================================
-- PART 1: COMPANIES TABLE
-- =============================================
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  display_name text,
  logo_url text,
  primary_color text DEFAULT '#1B4F72',
  secondary_color text DEFAULT '#2E86C1',
  contact_email text,
  contact_phone text,
  address text,
  plan text DEFAULT 'standard' CHECK (plan IN ('standard', 'whitelabel', 'premium')),
  max_users integer DEFAULT 15,
  is_active boolean DEFAULT true,
  subscription_start timestamptz,
  subscription_end timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.companies (id, name, slug, display_name, contact_email)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'AG Chauffage-Sanitaire',
  'ag-chauffage-sanitaire',
  'AG Chauffage-Sanitaire',
  'contact@ag-chauffage.be'
);

-- =============================================
-- PART 2: ALTER PROFILES — add company_id + role
-- =============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS role public.app_role DEFAULT 'ouvrier';

-- Populate role from user_roles (same values, no rename yet)
UPDATE public.profiles p
SET role = ur.role
FROM public.user_roles ur
WHERE ur.user_id = p.id;

-- Set company_id for ALL existing profiles
UPDATE public.profiles
SET company_id = '11111111-1111-1111-1111-111111111111'
WHERE company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- =============================================
-- PART 3: HELPER FUNCTIONS
-- =============================================
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Update has_role to read from profiles instead of user_roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_role() = 'super_admin'
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_role() = 'admin'
$$;

CREATE OR REPLACE FUNCTION public.is_bureau()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_role() = 'bureau'
$$;

CREATE OR REPLACE FUNCTION public.is_secretariat()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_role() = 'secretariat'
$$;

CREATE OR REPLACE FUNCTION public.is_ouvrier()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_role() = 'ouvrier'
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_secretariat()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_role() IN ('admin', 'secretariat', 'bureau')
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_bureau()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_role() IN ('admin', 'bureau')
$$;

-- =============================================
-- PART 4: ADD company_id TO ALL BUSINESS TABLES
-- =============================================
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.client_sites ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.client_equipment ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.work_tasks ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.parts_orders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.maintenance_schedules ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.pdf_settings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.binomes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Backfill all existing data
UPDATE public.clients SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE public.client_sites SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE public.client_equipment SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE public.work_tasks SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE public.intervention_sheets SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE public.parts_orders SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE public.maintenance_schedules SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE public.task_templates SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE public.pdf_settings SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE public.binomes SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;

-- Set NOT NULL after backfill
ALTER TABLE public.clients ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.client_sites ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.client_equipment ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.work_tasks ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.intervention_sheets ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.parts_orders ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.maintenance_schedules ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.task_templates ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.pdf_settings ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.binomes ALTER COLUMN company_id SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_client_sites_company ON public.client_sites(company_id);
CREATE INDEX IF NOT EXISTS idx_client_equipment_company ON public.client_equipment(company_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_company ON public.work_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_intervention_sheets_company ON public.intervention_sheets(company_id);
CREATE INDEX IF NOT EXISTS idx_parts_orders_company ON public.parts_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_company ON public.maintenance_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_company ON public.task_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_pdf_settings_company ON public.pdf_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_binomes_company ON public.binomes(company_id);

-- =============================================
-- PART 5: AUTO-SET company_id TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.set_company_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_my_company_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_company_id_clients BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_client_sites BEFORE INSERT ON public.client_sites FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_client_equipment BEFORE INSERT ON public.client_equipment FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_work_tasks BEFORE INSERT ON public.work_tasks FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_intervention_sheets BEFORE INSERT ON public.intervention_sheets FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_parts_orders BEFORE INSERT ON public.parts_orders FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_maintenance_schedules BEFORE INSERT ON public.maintenance_schedules FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_task_templates BEFORE INSERT ON public.task_templates FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_pdf_settings BEFORE INSERT ON public.pdf_settings FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_binomes BEFORE INSERT ON public.binomes FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

-- =============================================
-- PART 6: UPDATE handle_new_user
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'ouvrier'),
    (NEW.raw_user_meta_data ->> 'company_id')::uuid
  );
  RETURN NEW;
END;
$$;

-- =============================================
-- PART 7: UPDATE restrict_user_profile_update
-- =============================================
CREATE OR REPLACE FUNCTION public.restrict_user_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_super_admin() THEN RETURN NEW; END IF;

  -- Admin/bureau can manage profiles in their company
  IF public.is_admin() OR public.is_bureau() OR public.is_secretariat() THEN
    IF OLD.role IN ('admin', 'super_admin') AND OLD.id != auth.uid() THEN
      NEW.is_active := OLD.is_active;
      NEW.worker_level := OLD.worker_level;
      NEW.role := OLD.role;
    END IF;
    IF OLD.id = auth.uid() THEN
      NEW.is_active := OLD.is_active;
      NEW.role := OLD.role;
    END IF;
    NEW.company_id := OLD.company_id;
    RETURN NEW;
  END IF;

  -- Ouvrier: protect sensitive fields
  NEW.worker_level := OLD.worker_level;
  NEW.is_active := OLD.is_active;
  NEW.role := OLD.role;
  NEW.company_id := OLD.company_id;
  RETURN NEW;
END;
$$;

-- =============================================
-- PART 8: UPDATE get_my_clients_safe
-- =============================================
CREATE OR REPLACE FUNCTION public.get_my_clients_safe()
RETURNS TABLE(id uuid, name text, phone text, email text, address_intervention text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT c.id, c.name, c.phone, c.email, c.address_intervention
  FROM public.clients c
  INNER JOIN public.work_tasks wt ON wt.client_id = c.id
  WHERE wt.assigned_to = auth.uid()
    AND c.company_id = public.get_my_company_id();
$$;

-- =============================================
-- PART 9: DROP ALL OLD RLS POLICIES
-- =============================================

-- profiles
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin/secretariat/super_admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- clients
DROP POLICY IF EXISTS "Delete clients" ON public.clients;
DROP POLICY IF EXISTS "Insert clients" ON public.clients;
DROP POLICY IF EXISTS "Ouvrier can view clients for assigned tasks" ON public.clients;
DROP POLICY IF EXISTS "Update clients" ON public.clients;
DROP POLICY IF EXISTS "View clients" ON public.clients;

-- client_sites
DROP POLICY IF EXISTS "Delete sites" ON public.client_sites;
DROP POLICY IF EXISTS "Insert sites" ON public.client_sites;
DROP POLICY IF EXISTS "Ouvrier can view sites for assigned tasks" ON public.client_sites;
DROP POLICY IF EXISTS "Update sites" ON public.client_sites;
DROP POLICY IF EXISTS "View sites" ON public.client_sites;

-- client_equipment
DROP POLICY IF EXISTS "Delete equipment" ON public.client_equipment;
DROP POLICY IF EXISTS "Insert equipment" ON public.client_equipment;
DROP POLICY IF EXISTS "Ouvrier can view equipment for assigned tasks" ON public.client_equipment;
DROP POLICY IF EXISTS "Update equipment" ON public.client_equipment;
DROP POLICY IF EXISTS "View equipment" ON public.client_equipment;

-- work_tasks
DROP POLICY IF EXISTS "Delete tasks" ON public.work_tasks;
DROP POLICY IF EXISTS "Insert tasks" ON public.work_tasks;
DROP POLICY IF EXISTS "Ouvrier can update own tasks" ON public.work_tasks;
DROP POLICY IF EXISTS "Ouvrier can view own tasks" ON public.work_tasks;
DROP POLICY IF EXISTS "Update tasks" ON public.work_tasks;
DROP POLICY IF EXISTS "View all tasks" ON public.work_tasks;

-- intervention_sheets
DROP POLICY IF EXISTS "Delete sheets" ON public.intervention_sheets;
DROP POLICY IF EXISTS "Ouvrier can update own sheets" ON public.intervention_sheets;
DROP POLICY IF EXISTS "Ouvrier can view own sheets" ON public.intervention_sheets;
DROP POLICY IF EXISTS "Role-holder can insert sheets" ON public.intervention_sheets;
DROP POLICY IF EXISTS "Update sheets" ON public.intervention_sheets;
DROP POLICY IF EXISTS "View all sheets" ON public.intervention_sheets;

-- parts_orders
DROP POLICY IF EXISTS "Delete orders" ON public.parts_orders;
DROP POLICY IF EXISTS "Ouvrier can update own orders" ON public.parts_orders;
DROP POLICY IF EXISTS "Ouvrier can view own orders" ON public.parts_orders;
DROP POLICY IF EXISTS "Role-holder can insert orders" ON public.parts_orders;
DROP POLICY IF EXISTS "Update orders" ON public.parts_orders;
DROP POLICY IF EXISTS "View all orders" ON public.parts_orders;

-- maintenance_schedules
DROP POLICY IF EXISTS "Delete schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Insert schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Update schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "View schedules" ON public.maintenance_schedules;

-- task_templates
DROP POLICY IF EXISTS "Delete templates" ON public.task_templates;
DROP POLICY IF EXISTS "Insert templates" ON public.task_templates;
DROP POLICY IF EXISTS "Role-holders can view templates" ON public.task_templates;
DROP POLICY IF EXISTS "Update templates" ON public.task_templates;

-- pdf_settings
DROP POLICY IF EXISTS "Admins can insert pdf_settings" ON public.pdf_settings;
DROP POLICY IF EXISTS "Admins can update pdf_settings" ON public.pdf_settings;
DROP POLICY IF EXISTS "Admins can view pdf_settings" ON public.pdf_settings;

-- binomes
DROP POLICY IF EXISTS "Delete binomes" ON public.binomes;
DROP POLICY IF EXISTS "Insert binomes" ON public.binomes;
DROP POLICY IF EXISTS "Role-holders can view binomes" ON public.binomes;
DROP POLICY IF EXISTS "Update binomes" ON public.binomes;

-- user_roles
DROP POLICY IF EXISTS "Role management delete" ON public.user_roles;
DROP POLICY IF EXISTS "Role management insert" ON public.user_roles;
DROP POLICY IF EXISTS "Role management update" ON public.user_roles;
DROP POLICY IF EXISTS "Role viewing" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

-- push_tokens (keep existing policies, no company_id needed)

-- =============================================
-- PART 10: CREATE NEW RLS POLICIES
-- =============================================

-- === COMPANIES ===
CREATE POLICY "sa_all_companies" ON public.companies FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "member_view_company" ON public.companies FOR SELECT
  USING (id = public.get_my_company_id());
CREATE POLICY "admin_update_company" ON public.companies FOR UPDATE
  USING (id = public.get_my_company_id() AND public.is_admin_or_secretariat());

-- === PROFILES ===
CREATE POLICY "sa_all_profiles" ON public.profiles FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "own_view" ON public.profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY "own_update" ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "company_view_profiles" ON public.profiles FOR SELECT
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());
CREATE POLICY "company_manage_profiles" ON public.profiles FOR UPDATE
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());
CREATE POLICY "company_insert_profiles" ON public.profiles FOR INSERT
  WITH CHECK (public.is_super_admin() OR public.is_admin_or_secretariat() OR id = auth.uid());

-- === USER_ROLES (legacy, keep functional) ===
CREATE POLICY "sa_all_roles" ON public.user_roles FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "view_own_role" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "admin_view_roles" ON public.user_roles FOR SELECT
  USING (public.is_admin_or_secretariat());
CREATE POLICY "admin_manage_roles" ON public.user_roles FOR ALL
  USING (public.is_admin_or_secretariat() AND role NOT IN ('admin', 'super_admin'))
  WITH CHECK (public.is_admin_or_secretariat() AND role NOT IN ('admin', 'super_admin'));

-- === CLIENTS ===
CREATE POLICY "sa_all_clients" ON public.clients FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "company_all_clients" ON public.clients FOR ALL
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());
CREATE POLICY "ouvrier_view_clients" ON public.clients FOR SELECT
  USING (public.is_ouvrier() AND id IN (
    SELECT client_id FROM public.work_tasks
    WHERE assigned_to = auth.uid() AND client_id IS NOT NULL
  ));

-- === CLIENT_SITES ===
CREATE POLICY "sa_all_sites" ON public.client_sites FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "company_all_sites" ON public.client_sites FOR ALL
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());
CREATE POLICY "ouvrier_view_sites" ON public.client_sites FOR SELECT
  USING (public.is_ouvrier() AND id IN (
    SELECT client_site_id FROM public.work_tasks WHERE assigned_to = auth.uid()
  ));

-- === CLIENT_EQUIPMENT ===
CREATE POLICY "sa_all_equipment" ON public.client_equipment FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "company_all_equipment" ON public.client_equipment FOR ALL
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());
CREATE POLICY "ouvrier_view_equipment" ON public.client_equipment FOR SELECT
  USING (public.is_ouvrier() AND client_site_id IN (
    SELECT client_site_id FROM public.work_tasks WHERE assigned_to = auth.uid()
  ));

-- === WORK_TASKS ===
CREATE POLICY "sa_all_tasks" ON public.work_tasks FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "company_all_tasks" ON public.work_tasks FOR ALL
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());
CREATE POLICY "ouvrier_view_tasks" ON public.work_tasks FOR SELECT
  USING (public.is_ouvrier() AND (assigned_to = auth.uid() OR second_assigned_to = auth.uid()));
CREATE POLICY "ouvrier_update_tasks" ON public.work_tasks FOR UPDATE
  USING (public.is_ouvrier() AND assigned_to = auth.uid());

-- === INTERVENTION_SHEETS ===
CREATE POLICY "sa_all_sheets" ON public.intervention_sheets FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "company_all_sheets" ON public.intervention_sheets FOR ALL
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());
CREATE POLICY "ouvrier_view_sheets" ON public.intervention_sheets FOR SELECT
  USING (public.is_ouvrier() AND worker_id = auth.uid());
CREATE POLICY "ouvrier_update_sheets" ON public.intervention_sheets FOR UPDATE
  USING (public.is_ouvrier() AND worker_id = auth.uid());
CREATE POLICY "ouvrier_insert_sheets" ON public.intervention_sheets FOR INSERT
  WITH CHECK (public.is_ouvrier() AND worker_id = auth.uid());

-- === PARTS_ORDERS ===
CREATE POLICY "sa_all_orders" ON public.parts_orders FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "company_all_orders" ON public.parts_orders FOR ALL
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());
CREATE POLICY "ouvrier_view_orders" ON public.parts_orders FOR SELECT
  USING (public.is_ouvrier() AND requested_by = auth.uid());
CREATE POLICY "ouvrier_update_orders" ON public.parts_orders FOR UPDATE
  USING (public.is_ouvrier() AND requested_by = auth.uid());
CREATE POLICY "ouvrier_insert_orders" ON public.parts_orders FOR INSERT
  WITH CHECK (public.is_ouvrier() AND requested_by = auth.uid());

-- === MAINTENANCE_SCHEDULES ===
CREATE POLICY "sa_all_schedules" ON public.maintenance_schedules FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "company_all_schedules" ON public.maintenance_schedules FOR ALL
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());

-- === TASK_TEMPLATES ===
CREATE POLICY "sa_all_templates" ON public.task_templates FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "company_all_templates" ON public.task_templates FOR ALL
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());
CREATE POLICY "ouvrier_view_templates" ON public.task_templates FOR SELECT
  USING (public.is_ouvrier() AND company_id = public.get_my_company_id());

-- === PDF_SETTINGS ===
CREATE POLICY "sa_all_pdf" ON public.pdf_settings FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "company_all_pdf" ON public.pdf_settings FOR ALL
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());

-- === BINOMES ===
CREATE POLICY "sa_all_binomes" ON public.binomes FOR ALL
  USING (public.is_super_admin());
CREATE POLICY "company_all_binomes" ON public.binomes FOR ALL
  USING (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin_or_secretariat());
CREATE POLICY "ouvrier_view_binomes" ON public.binomes FOR SELECT
  USING (public.is_ouvrier() AND company_id = public.get_my_company_id());

-- =============================================
-- PART 11: STORAGE BUCKET
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read company assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-assets');

CREATE POLICY "SA upload company assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'company-assets' AND public.is_super_admin());

CREATE POLICY "SA update company assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'company-assets' AND public.is_super_admin());

CREATE POLICY "SA delete company assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'company-assets' AND public.is_super_admin());

CREATE POLICY "Admin upload own company assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-assets'
    AND public.is_admin_or_secretariat()
    AND (storage.foldername(name))[1] = public.get_my_company_id()::text
  );

CREATE POLICY "Admin update own company assets" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'company-assets'
    AND public.is_admin_or_secretariat()
    AND (storage.foldername(name))[1] = public.get_my_company_id()::text
  );
