-- Restrict binomes SELECT to role-holders only
DROP POLICY "All authenticated can view binomes" ON public.binomes;
CREATE POLICY "Role-holders can view binomes" ON public.binomes
  FOR SELECT TO authenticated
  USING (public.is_admin_or_secretariat() OR public.is_ouvrier());

-- Restrict task_templates SELECT to role-holders only
DROP POLICY "All authenticated can view templates" ON public.task_templates;
CREATE POLICY "Role-holders can view templates" ON public.task_templates
  FOR SELECT TO authenticated
  USING (public.is_admin_or_secretariat() OR public.is_ouvrier());