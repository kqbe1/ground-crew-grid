
-- ============================================
-- PROFILES: admin/bureau see company profiles, super_admin sees all
-- ============================================
CREATE POLICY "company_view_profiles" ON public.profiles FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id() OR public.is_super_admin());

-- ============================================
-- CLIENTS
-- ============================================
CREATE POLICY "company_select_clients" ON public.clients FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id() OR public.is_super_admin());

CREATE POLICY "company_insert_clients" ON public.clients FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_bureau() OR public.is_super_admin());

CREATE POLICY "company_update_clients" ON public.clients FOR UPDATE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

CREATE POLICY "company_delete_clients" ON public.clients FOR DELETE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

-- ============================================
-- CLIENT_SITES
-- ============================================
CREATE POLICY "company_select_client_sites" ON public.client_sites FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id() OR public.is_super_admin());

CREATE POLICY "company_insert_client_sites" ON public.client_sites FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_bureau() OR public.is_super_admin());

CREATE POLICY "company_update_client_sites" ON public.client_sites FOR UPDATE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

CREATE POLICY "company_delete_client_sites" ON public.client_sites FOR DELETE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

-- ============================================
-- CLIENT_EQUIPMENT
-- ============================================
CREATE POLICY "company_select_client_equipment" ON public.client_equipment FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id() OR public.is_super_admin());

CREATE POLICY "company_insert_client_equipment" ON public.client_equipment FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_bureau() OR public.is_super_admin());

CREATE POLICY "company_update_client_equipment" ON public.client_equipment FOR UPDATE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

CREATE POLICY "company_delete_client_equipment" ON public.client_equipment FOR DELETE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

-- ============================================
-- WORK_TASKS
-- ============================================
CREATE POLICY "company_select_work_tasks" ON public.work_tasks FOR SELECT TO authenticated
USING (
  company_id = public.get_my_company_id() 
  AND (
    public.is_admin_or_bureau() 
    OR assigned_to = auth.uid() 
    OR second_assigned_to = auth.uid()
  )
  OR public.is_super_admin()
);

CREATE POLICY "company_insert_work_tasks" ON public.work_tasks FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_bureau() OR public.is_super_admin());

CREATE POLICY "company_update_work_tasks" ON public.work_tasks FOR UPDATE TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND (
    public.is_admin_or_bureau()
    OR assigned_to = auth.uid()
    OR second_assigned_to = auth.uid()
  )
  OR public.is_super_admin()
);

CREATE POLICY "company_delete_work_tasks" ON public.work_tasks FOR DELETE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

-- ============================================
-- INTERVENTION_SHEETS
-- ============================================
CREATE POLICY "company_select_sheets" ON public.intervention_sheets FOR SELECT TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND (public.is_admin_or_bureau() OR worker_id = auth.uid())
  OR public.is_super_admin()
);

CREATE POLICY "company_insert_sheets" ON public.intervention_sheets FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_my_company_id()
  AND (public.is_admin_or_bureau() OR worker_id = auth.uid())
  OR public.is_super_admin()
);

CREATE POLICY "company_update_sheets" ON public.intervention_sheets FOR UPDATE TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND (public.is_admin_or_bureau() OR worker_id = auth.uid())
  OR public.is_super_admin()
);

CREATE POLICY "company_delete_sheets" ON public.intervention_sheets FOR DELETE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

-- ============================================
-- PARTS_ORDERS
-- ============================================
CREATE POLICY "company_select_orders" ON public.parts_orders FOR SELECT TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND (public.is_admin_or_bureau() OR requested_by = auth.uid())
  OR public.is_super_admin()
);

CREATE POLICY "company_insert_orders" ON public.parts_orders FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_my_company_id()
  OR public.is_super_admin()
);

CREATE POLICY "company_update_orders" ON public.parts_orders FOR UPDATE TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND (public.is_admin_or_bureau() OR requested_by = auth.uid())
  OR public.is_super_admin()
);

CREATE POLICY "company_delete_orders" ON public.parts_orders FOR DELETE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

-- ============================================
-- TASK_TEMPLATES
-- ============================================
CREATE POLICY "company_select_templates" ON public.task_templates FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id() OR public.is_super_admin());

CREATE POLICY "company_insert_templates" ON public.task_templates FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_bureau() OR public.is_super_admin());

CREATE POLICY "company_update_templates" ON public.task_templates FOR UPDATE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

CREATE POLICY "company_delete_templates" ON public.task_templates FOR DELETE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

-- ============================================
-- PDF_SETTINGS
-- ============================================
CREATE POLICY "company_select_pdf" ON public.pdf_settings FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id() OR public.is_super_admin());

CREATE POLICY "company_insert_pdf" ON public.pdf_settings FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_bureau() OR public.is_super_admin());

CREATE POLICY "company_update_pdf" ON public.pdf_settings FOR UPDATE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

-- ============================================
-- MAINTENANCE_SCHEDULES
-- ============================================
CREATE POLICY "company_select_maintenance" ON public.maintenance_schedules FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id() OR public.is_super_admin());

CREATE POLICY "company_insert_maintenance" ON public.maintenance_schedules FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_bureau() OR public.is_super_admin());

CREATE POLICY "company_update_maintenance" ON public.maintenance_schedules FOR UPDATE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

CREATE POLICY "company_delete_maintenance" ON public.maintenance_schedules FOR DELETE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

-- ============================================
-- BINOMES
-- ============================================
CREATE POLICY "company_select_binomes" ON public.binomes FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id() OR public.is_super_admin());

CREATE POLICY "company_insert_binomes" ON public.binomes FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_bureau() OR public.is_super_admin());

CREATE POLICY "company_update_binomes" ON public.binomes FOR UPDATE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));

CREATE POLICY "company_delete_binomes" ON public.binomes FOR DELETE TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_admin_or_bureau() OR public.is_super_admin()));
