
-- 1) Add binome_level to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS binome_level text;

-- 2) Adjust restrict_user_profile_update to handle binome_level the same as worker_level
CREATE OR REPLACE FUNCTION public.restrict_user_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF private.is_super_admin() THEN RETURN NEW; END IF;
  IF private.is_admin() OR private.is_bureau() THEN
    IF OLD.role IN ('admin','super_admin') AND OLD.id <> auth.uid() THEN
      NEW.is_active := OLD.is_active;
      NEW.worker_level := OLD.worker_level;
      NEW.binome_level := OLD.binome_level;
      NEW.role := OLD.role;
    END IF;
    IF OLD.id = auth.uid() THEN
      NEW.is_active := OLD.is_active;
      NEW.role := OLD.role;
    END IF;
    NEW.company_id := OLD.company_id;
    RETURN NEW;
  END IF;
  NEW.worker_level := OLD.worker_level;
  NEW.binome_level := OLD.binome_level;
  NEW.is_active := OLD.is_active;
  NEW.role := OLD.role;
  NEW.company_id := OLD.company_id;
  RETURN NEW;
END;
$function$;

-- 3) Legal maintenance rules per company × energy × region
CREATE TABLE IF NOT EXISTS public.legal_maintenance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  energy_type text NOT NULL,
  region text NOT NULL,
  periodicity text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, energy_type, region)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_maintenance_rules TO authenticated;
GRANT ALL ON public.legal_maintenance_rules TO service_role;

ALTER TABLE public.legal_maintenance_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sa_all_legal_rules ON public.legal_maintenance_rules;
CREATE POLICY sa_all_legal_rules ON public.legal_maintenance_rules
  FOR ALL TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

DROP POLICY IF EXISTS company_select_legal_rules ON public.legal_maintenance_rules;
CREATE POLICY company_select_legal_rules ON public.legal_maintenance_rules
  FOR SELECT TO authenticated
  USING (company_id = private.get_my_company_id());

DROP POLICY IF EXISTS company_write_legal_rules ON public.legal_maintenance_rules;
CREATE POLICY company_write_legal_rules ON public.legal_maintenance_rules
  FOR ALL TO authenticated
  USING (company_id = private.get_my_company_id() AND private.is_admin_or_bureau())
  WITH CHECK (company_id = private.get_my_company_id() AND private.is_admin_or_bureau());

-- Auto-fill company_id on insert
DROP TRIGGER IF EXISTS trg_legal_rules_set_company ON public.legal_maintenance_rules;
CREATE TRIGGER trg_legal_rules_set_company
  BEFORE INSERT ON public.legal_maintenance_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS trg_legal_rules_updated_at ON public.legal_maintenance_rules;
CREATE TRIGGER trg_legal_rules_updated_at
  BEFORE UPDATE ON public.legal_maintenance_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed standard Belgian rules for every existing company
INSERT INTO public.legal_maintenance_rules (company_id, energy_type, region, periodicity)
SELECT c.id, e.energy_type, r.region, e.periodicity
FROM public.companies c
CROSS JOIN (VALUES
  ('gaz','annuel'),
  ('mazout','annuel'),
  ('pellets','annuel'),
  ('clim','annuel'),
  ('vmc','annuel')
) AS e(energy_type, periodicity)
CROSS JOIN (VALUES ('bruxelles'), ('wallonie'), ('flandre')) AS r(region)
ON CONFLICT (company_id, energy_type, region) DO NOTHING;
