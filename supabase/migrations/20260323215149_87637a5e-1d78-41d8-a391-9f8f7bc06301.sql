
-- Fix profiles SELECT: super_admin must see all profiles
DROP POLICY IF EXISTS "Admin/secretariat can view all profiles" ON public.profiles;
CREATE POLICY "Admin/secretariat/super_admin can view all profiles" ON public.profiles
FOR SELECT TO public
USING (is_admin_or_secretariat() OR is_super_admin());

-- Fix profiles INSERT: super_admin can insert
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
CREATE POLICY "Admin can insert profiles" ON public.profiles
FOR INSERT TO public
WITH CHECK (is_admin() OR is_super_admin() OR (id = auth.uid()));

-- Fix profiles DELETE: super_admin can delete
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
CREATE POLICY "Admin can delete profiles" ON public.profiles
FOR DELETE TO public
USING (is_super_admin() OR is_admin());

-- Fix user_roles SELECT: already done in prior migration (is_admin() OR is_super_admin())

-- Fix clients: super_admin access
DROP POLICY IF EXISTS "Admin/secretariat can view clients" ON public.clients;
CREATE POLICY "View clients" ON public.clients FOR SELECT TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can insert clients" ON public.clients;
CREATE POLICY "Insert clients" ON public.clients FOR INSERT TO public
WITH CHECK (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can update clients" ON public.clients;
CREATE POLICY "Update clients" ON public.clients FOR UPDATE TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin can delete clients" ON public.clients;
CREATE POLICY "Delete clients" ON public.clients FOR DELETE TO public
USING (is_admin() OR is_super_admin());

-- Fix work_tasks: super_admin access
DROP POLICY IF EXISTS "Admin/secretariat can view all tasks" ON public.work_tasks;
CREATE POLICY "View all tasks" ON public.work_tasks FOR SELECT TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can insert tasks" ON public.work_tasks;
CREATE POLICY "Insert tasks" ON public.work_tasks FOR INSERT TO public
WITH CHECK (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can update tasks" ON public.work_tasks;
CREATE POLICY "Update tasks" ON public.work_tasks FOR UPDATE TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can delete tasks" ON public.work_tasks;
CREATE POLICY "Delete tasks" ON public.work_tasks FOR DELETE TO public
USING (is_admin_or_secretariat() OR is_super_admin());

-- Fix parts_orders: super_admin access
DROP POLICY IF EXISTS "Admin/secretariat can view all orders" ON public.parts_orders;
CREATE POLICY "View all orders" ON public.parts_orders FOR SELECT TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can update orders" ON public.parts_orders;
CREATE POLICY "Update orders" ON public.parts_orders FOR UPDATE TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can delete orders" ON public.parts_orders;
CREATE POLICY "Delete orders" ON public.parts_orders FOR DELETE TO public
USING (is_admin_or_secretariat() OR is_super_admin());

-- Fix intervention_sheets: super_admin access
DROP POLICY IF EXISTS "Admin/secretariat can view all sheets" ON public.intervention_sheets;
CREATE POLICY "View all sheets" ON public.intervention_sheets FOR SELECT TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can update sheets" ON public.intervention_sheets;
CREATE POLICY "Update sheets" ON public.intervention_sheets FOR UPDATE TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin can delete sheets" ON public.intervention_sheets;
CREATE POLICY "Delete sheets" ON public.intervention_sheets FOR DELETE TO public
USING (is_admin() OR is_super_admin());

-- Fix maintenance_schedules: super_admin access
DROP POLICY IF EXISTS "Admin/secretariat can view schedules" ON public.maintenance_schedules;
CREATE POLICY "View schedules" ON public.maintenance_schedules FOR SELECT TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can insert schedules" ON public.maintenance_schedules;
CREATE POLICY "Insert schedules" ON public.maintenance_schedules FOR INSERT TO public
WITH CHECK (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can update schedules" ON public.maintenance_schedules;
CREATE POLICY "Update schedules" ON public.maintenance_schedules FOR UPDATE TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin can delete schedules" ON public.maintenance_schedules;
CREATE POLICY "Delete schedules" ON public.maintenance_schedules FOR DELETE TO public
USING (is_admin() OR is_super_admin());

-- Fix task_templates: super_admin access
DROP POLICY IF EXISTS "Admin can insert templates" ON public.task_templates;
CREATE POLICY "Insert templates" ON public.task_templates FOR INSERT TO public
WITH CHECK (is_admin() OR is_super_admin());

DROP POLICY IF EXISTS "Admin can update templates" ON public.task_templates;
CREATE POLICY "Update templates" ON public.task_templates FOR UPDATE TO public
USING (is_admin() OR is_super_admin());

DROP POLICY IF EXISTS "Admin can delete templates" ON public.task_templates;
CREATE POLICY "Delete templates" ON public.task_templates FOR DELETE TO public
USING (is_admin() OR is_super_admin());

-- Fix client_sites: super_admin access
DROP POLICY IF EXISTS "Admin/secretariat can view sites" ON public.client_sites;
CREATE POLICY "View sites" ON public.client_sites FOR SELECT TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can insert sites" ON public.client_sites;
CREATE POLICY "Insert sites" ON public.client_sites FOR INSERT TO public
WITH CHECK (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can update sites" ON public.client_sites;
CREATE POLICY "Update sites" ON public.client_sites FOR UPDATE TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin can delete sites" ON public.client_sites;
CREATE POLICY "Delete sites" ON public.client_sites FOR DELETE TO public
USING (is_admin() OR is_super_admin());

-- Fix client_equipment: super_admin access
DROP POLICY IF EXISTS "Admin/secretariat can view equipment" ON public.client_equipment;
CREATE POLICY "View equipment" ON public.client_equipment FOR SELECT TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can insert equipment" ON public.client_equipment;
CREATE POLICY "Insert equipment" ON public.client_equipment FOR INSERT TO public
WITH CHECK (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can update equipment" ON public.client_equipment;
CREATE POLICY "Update equipment" ON public.client_equipment FOR UPDATE TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin can delete equipment" ON public.client_equipment;
CREATE POLICY "Delete equipment" ON public.client_equipment FOR DELETE TO public
USING (is_admin() OR is_super_admin());

-- Fix binomes: super_admin access  
DROP POLICY IF EXISTS "Admin/secretariat can insert binomes" ON public.binomes;
CREATE POLICY "Insert binomes" ON public.binomes FOR INSERT TO public
WITH CHECK (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin/secretariat can update binomes" ON public.binomes;
CREATE POLICY "Update binomes" ON public.binomes FOR UPDATE TO public
USING (is_admin_or_secretariat() OR is_super_admin());

DROP POLICY IF EXISTS "Admin can delete binomes" ON public.binomes;
CREATE POLICY "Delete binomes" ON public.binomes FOR DELETE TO public
USING (is_admin() OR is_super_admin());
