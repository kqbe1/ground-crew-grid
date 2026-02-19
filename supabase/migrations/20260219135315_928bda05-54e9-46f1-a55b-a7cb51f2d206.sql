
-- =============================================
-- ENUM TYPES
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'secretariat', 'ouvrier');
CREATE TYPE public.worker_level AS ENUM ('T0', 'T1', 'T2');
CREATE TYPE public.task_status AS ENUM ('planifie', 'termine', 'a_replanifier', 'piece_a_commander');
CREATE TYPE public.order_status AS ENUM ('demandee', 'commandee', 'recue', 'cloturee');
CREATE TYPE public.order_urgency AS ENUM ('normal', 'urgent', 'critique');
CREATE TYPE public.intervention_type AS ENUM ('entretien_gaz', 'entretien_mazout', 'entretien_pellets', 'entretien_clim', 'entretien_vmc', 'depannage', 'installation', 'remplacement', 'rdv_divers', 'autre');
CREATE TYPE public.energy_type AS ENUM ('gaz', 'mazout', 'pellets', 'electricite', 'clim', 'vmc', 'autre');
CREATE TYPE public.maintenance_periodicity AS ENUM ('mensuel', 'trimestriel', 'semestriel', 'annuel', 'bisannuel', 'triennal');

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  worker_level public.worker_level,
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- USER ROLES TABLE
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- =============================================
-- BINOMES TABLE
-- =============================================
CREATE TABLE public.binomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user1_percentage INTEGER NOT NULL DEFAULT 50 CHECK (user1_percentage >= 0 AND user1_percentage <= 100),
  user2_percentage INTEGER NOT NULL DEFAULT 50 CHECK (user2_percentage >= 0 AND user2_percentage <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- CLIENTS TABLE
-- =============================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  phone_secondary TEXT,
  address_intervention TEXT,
  address_billing TEXT,
  contact_syndic TEXT,
  contact_locataire TEXT,
  notes_internal TEXT,
  syndic_keys_codes TEXT,
  birthday DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- CLIENT SITES TABLE
-- =============================================
CREATE TABLE public.client_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- CLIENT EQUIPMENT TABLE
-- =============================================
CREATE TABLE public.client_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_site_id UUID NOT NULL REFERENCES public.client_sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  energy_type public.energy_type NOT NULL DEFAULT 'autre',
  brand TEXT,
  model TEXT,
  maintenance_periodicity public.maintenance_periodicity,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TASK TEMPLATES TABLE
-- =============================================
CREATE TABLE public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  intervention_type public.intervention_type NOT NULL DEFAULT 'autre',
  description TEXT,
  default_duration_minutes INTEGER NOT NULL DEFAULT 60,
  checklist JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- WORK TASKS TABLE
-- =============================================
CREATE TABLE public.work_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  intervention_type public.intervention_type NOT NULL DEFAULT 'autre',
  status public.task_status NOT NULL DEFAULT 'planifie',
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  assigned_to UUID REFERENCES public.profiles(id),
  binome_id UUID REFERENCES public.binomes(id),
  client_id UUID REFERENCES public.clients(id),
  client_site_id UUID REFERENCES public.client_sites(id),
  equipment_id UUID REFERENCES public.client_equipment(id),
  template_id UUID REFERENCES public.task_templates(id),
  memo_secretariat TEXT,
  material_needed TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  wait_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INTERVENTION SHEETS TABLE
-- =============================================
CREATE TABLE public.intervention_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_task_id UUID NOT NULL REFERENCES public.work_tasks(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id),
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  description TEXT,
  checklist_results JSONB DEFAULT '[]'::jsonb,
  photos_before TEXT[] DEFAULT '{}',
  photos_after TEXT[] DEFAULT '{}',
  final_status public.task_status NOT NULL DEFAULT 'termine',
  client_present BOOLEAN NOT NULL DEFAULT true,
  client_absent BOOLEAN NOT NULL DEFAULT false,
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  is_draft BOOLEAN NOT NULL DEFAULT false,
  sent_to_client BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- PARTS ORDERS TABLE
-- =============================================
CREATE TABLE public.parts_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_task_id UUID REFERENCES public.work_tasks(id),
  client_id UUID REFERENCES public.clients(id),
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  part_name TEXT NOT NULL,
  part_reference TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  status public.order_status NOT NULL DEFAULT 'demandee',
  urgency public.order_urgency NOT NULL DEFAULT 'normal',
  notes TEXT,
  supplier TEXT,
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- MAINTENANCE SCHEDULES TABLE
-- =============================================
CREATE TABLE public.maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_site_id UUID REFERENCES public.client_sites(id),
  equipment_id UUID REFERENCES public.client_equipment(id),
  intervention_type public.intervention_type NOT NULL,
  periodicity public.maintenance_periodicity NOT NULL DEFAULT 'annuel',
  last_done_date DATE,
  next_due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'actif',
  legal_alert_years INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_work_tasks_date ON public.work_tasks(scheduled_date);
CREATE INDEX idx_work_tasks_assigned ON public.work_tasks(assigned_to);
CREATE INDEX idx_work_tasks_status ON public.work_tasks(status);
CREATE INDEX idx_work_tasks_client ON public.work_tasks(client_id);
CREATE INDEX idx_intervention_sheets_task ON public.intervention_sheets(work_task_id);
CREATE INDEX idx_parts_orders_status ON public.parts_orders(status);
CREATE INDEX idx_parts_orders_client ON public.parts_orders(client_id);
CREATE INDEX idx_maintenance_next_due ON public.maintenance_schedules(next_due_date);
CREATE INDEX idx_client_equipment_site ON public.client_equipment(client_site_id);
CREATE INDEX idx_client_sites_client ON public.client_sites(client_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- =============================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_secretariat()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'secretariat')
$$;

CREATE OR REPLACE FUNCTION public.is_ouvrier()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'ouvrier')
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_secretariat()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.is_secretariat()
$$;

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_binomes_updated_at BEFORE UPDATE ON public.binomes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_sites_updated_at BEFORE UPDATE ON public.client_sites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_equipment_updated_at BEFORE UPDATE ON public.client_equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_task_templates_updated_at BEFORE UPDATE ON public.task_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_tasks_updated_at BEFORE UPDATE ON public.work_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_intervention_sheets_updated_at BEFORE UPDATE ON public.intervention_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_parts_orders_updated_at BEFORE UPDATE ON public.parts_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_maintenance_schedules_updated_at BEFORE UPDATE ON public.maintenance_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.binomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES — PROFILES
-- =============================================
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admin/secretariat can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin_or_secretariat());
CREATE POLICY "Admin can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.is_admin() OR id = auth.uid());
CREATE POLICY "Admin can update any profile" ON public.profiles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admin can delete profiles" ON public.profiles FOR DELETE USING (public.is_admin());

-- =============================================
-- RLS POLICIES — USER_ROLES
-- =============================================
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin can view all roles" ON public.user_roles FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update roles" ON public.user_roles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE USING (public.is_admin());

-- =============================================
-- RLS POLICIES — CLIENTS
-- =============================================
CREATE POLICY "Admin/secretariat can view clients" ON public.clients FOR SELECT USING (public.is_admin_or_secretariat());
CREATE POLICY "Ouvrier can view clients for assigned tasks" ON public.clients FOR SELECT USING (
  public.is_ouvrier() AND id IN (SELECT client_id FROM public.work_tasks WHERE assigned_to = auth.uid())
);
CREATE POLICY "Admin/secretariat can insert clients" ON public.clients FOR INSERT WITH CHECK (public.is_admin_or_secretariat());
CREATE POLICY "Admin/secretariat can update clients" ON public.clients FOR UPDATE USING (public.is_admin_or_secretariat());
CREATE POLICY "Admin can delete clients" ON public.clients FOR DELETE USING (public.is_admin());

-- =============================================
-- RLS POLICIES — CLIENT_SITES
-- =============================================
CREATE POLICY "Admin/secretariat can view sites" ON public.client_sites FOR SELECT USING (public.is_admin_or_secretariat());
CREATE POLICY "Ouvrier can view sites for assigned tasks" ON public.client_sites FOR SELECT USING (
  public.is_ouvrier() AND id IN (SELECT client_site_id FROM public.work_tasks WHERE assigned_to = auth.uid())
);
CREATE POLICY "Admin/secretariat can insert sites" ON public.client_sites FOR INSERT WITH CHECK (public.is_admin_or_secretariat());
CREATE POLICY "Admin/secretariat can update sites" ON public.client_sites FOR UPDATE USING (public.is_admin_or_secretariat());
CREATE POLICY "Admin can delete sites" ON public.client_sites FOR DELETE USING (public.is_admin());

-- =============================================
-- RLS POLICIES — CLIENT_EQUIPMENT
-- =============================================
CREATE POLICY "Admin/secretariat can view equipment" ON public.client_equipment FOR SELECT USING (public.is_admin_or_secretariat());
CREATE POLICY "Ouvrier can view equipment for assigned tasks" ON public.client_equipment FOR SELECT USING (
  public.is_ouvrier() AND client_site_id IN (SELECT client_site_id FROM public.work_tasks WHERE assigned_to = auth.uid())
);
CREATE POLICY "Admin/secretariat can insert equipment" ON public.client_equipment FOR INSERT WITH CHECK (public.is_admin_or_secretariat());
CREATE POLICY "Admin/secretariat can update equipment" ON public.client_equipment FOR UPDATE USING (public.is_admin_or_secretariat());
CREATE POLICY "Admin can delete equipment" ON public.client_equipment FOR DELETE USING (public.is_admin());

-- =============================================
-- RLS POLICIES — TASK_TEMPLATES
-- =============================================
CREATE POLICY "All authenticated can view templates" ON public.task_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can insert templates" ON public.task_templates FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update templates" ON public.task_templates FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete templates" ON public.task_templates FOR DELETE USING (public.is_admin());

-- =============================================
-- RLS POLICIES — WORK_TASKS
-- =============================================
CREATE POLICY "Admin/secretariat can view all tasks" ON public.work_tasks FOR SELECT USING (public.is_admin_or_secretariat());
CREATE POLICY "Ouvrier can view own tasks" ON public.work_tasks FOR SELECT USING (public.is_ouvrier() AND assigned_to = auth.uid());
CREATE POLICY "Admin/secretariat can insert tasks" ON public.work_tasks FOR INSERT WITH CHECK (public.is_admin_or_secretariat());
CREATE POLICY "Admin/secretariat can update tasks" ON public.work_tasks FOR UPDATE USING (public.is_admin_or_secretariat());
CREATE POLICY "Ouvrier can update own tasks" ON public.work_tasks FOR UPDATE USING (public.is_ouvrier() AND assigned_to = auth.uid());
CREATE POLICY "Admin can delete tasks" ON public.work_tasks FOR DELETE USING (public.is_admin());

-- =============================================
-- RLS POLICIES — INTERVENTION_SHEETS
-- =============================================
CREATE POLICY "Admin/secretariat can view all sheets" ON public.intervention_sheets FOR SELECT USING (public.is_admin_or_secretariat());
CREATE POLICY "Ouvrier can view own sheets" ON public.intervention_sheets FOR SELECT USING (public.is_ouvrier() AND worker_id = auth.uid());
CREATE POLICY "Authenticated can insert sheets" ON public.intervention_sheets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin/secretariat can update sheets" ON public.intervention_sheets FOR UPDATE USING (public.is_admin_or_secretariat());
CREATE POLICY "Ouvrier can update own sheets" ON public.intervention_sheets FOR UPDATE USING (public.is_ouvrier() AND worker_id = auth.uid());
CREATE POLICY "Admin can delete sheets" ON public.intervention_sheets FOR DELETE USING (public.is_admin());

-- =============================================
-- RLS POLICIES — PARTS_ORDERS
-- =============================================
CREATE POLICY "Admin/secretariat can view all orders" ON public.parts_orders FOR SELECT USING (public.is_admin_or_secretariat());
CREATE POLICY "Ouvrier can view own orders" ON public.parts_orders FOR SELECT USING (public.is_ouvrier() AND requested_by = auth.uid());
CREATE POLICY "Authenticated can insert orders" ON public.parts_orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin/secretariat can update orders" ON public.parts_orders FOR UPDATE USING (public.is_admin_or_secretariat());
CREATE POLICY "Ouvrier can update own orders" ON public.parts_orders FOR UPDATE USING (public.is_ouvrier() AND requested_by = auth.uid());
CREATE POLICY "Admin/secretariat can delete orders" ON public.parts_orders FOR DELETE USING (public.is_admin_or_secretariat());

-- =============================================
-- RLS POLICIES — MAINTENANCE_SCHEDULES
-- =============================================
CREATE POLICY "Admin/secretariat can view schedules" ON public.maintenance_schedules FOR SELECT USING (public.is_admin_or_secretariat());
CREATE POLICY "Admin/secretariat can insert schedules" ON public.maintenance_schedules FOR INSERT WITH CHECK (public.is_admin_or_secretariat());
CREATE POLICY "Admin/secretariat can update schedules" ON public.maintenance_schedules FOR UPDATE USING (public.is_admin_or_secretariat());
CREATE POLICY "Admin can delete schedules" ON public.maintenance_schedules FOR DELETE USING (public.is_admin());

-- =============================================
-- RLS POLICIES — BINOMES
-- =============================================
CREATE POLICY "All authenticated can view binomes" ON public.binomes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin/secretariat can insert binomes" ON public.binomes FOR INSERT WITH CHECK (public.is_admin_or_secretariat());
CREATE POLICY "Admin/secretariat can update binomes" ON public.binomes FOR UPDATE USING (public.is_admin_or_secretariat());
CREATE POLICY "Admin can delete binomes" ON public.binomes FOR DELETE USING (public.is_admin());
