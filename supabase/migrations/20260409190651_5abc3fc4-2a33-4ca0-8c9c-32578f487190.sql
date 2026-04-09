
-- Activity logs table for super admin
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type TEXT,
  target_id UUID,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_company_id ON public.activity_logs(company_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_select_logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "sa_insert_logs" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- Platform settings table
CREATE TABLE public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_select_settings" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "sa_update_settings" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "sa_insert_settings" ON public.platform_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "sa_delete_settings" ON public.platform_settings
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default platform settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('default_max_users', '25', 'Nombre maximum d''utilisateurs par défaut pour une nouvelle entreprise'),
  ('default_plan', '"standard"', 'Plan par défaut pour une nouvelle entreprise'),
  ('maintenance_mode', 'false', 'Mode maintenance global de la plateforme'),
  ('allowed_plans', '["starter", "standard", "premium"]', 'Plans disponibles');

-- Create a function to log activity (can be called from edge functions or triggers)
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_company_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.activity_logs (action, actor_id, target_type, target_id, company_id, metadata)
  VALUES (p_action, p_actor_id, p_target_type, p_target_id, p_company_id, p_metadata);
END;
$$;
