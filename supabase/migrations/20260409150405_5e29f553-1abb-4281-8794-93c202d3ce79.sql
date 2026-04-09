
-- Fix INSERT policies: add company_id check

-- clients
DROP POLICY IF EXISTS "company_insert_clients" ON public.clients;
CREATE POLICY "company_insert_clients" ON public.clients FOR INSERT TO authenticated
WITH CHECK ((company_id = get_my_company_id() AND is_admin_or_bureau()) OR is_super_admin());

-- client_sites
DROP POLICY IF EXISTS "company_insert_client_sites" ON public.client_sites;
CREATE POLICY "company_insert_client_sites" ON public.client_sites FOR INSERT TO authenticated
WITH CHECK ((company_id = get_my_company_id() AND is_admin_or_bureau()) OR is_super_admin());

-- client_equipment
DROP POLICY IF EXISTS "company_insert_client_equipment" ON public.client_equipment;
CREATE POLICY "company_insert_client_equipment" ON public.client_equipment FOR INSERT TO authenticated
WITH CHECK ((company_id = get_my_company_id() AND is_admin_or_bureau()) OR is_super_admin());

-- maintenance_schedules
DROP POLICY IF EXISTS "company_insert_maintenance" ON public.maintenance_schedules;
CREATE POLICY "company_insert_maintenance" ON public.maintenance_schedules FOR INSERT TO authenticated
WITH CHECK ((company_id = get_my_company_id() AND is_admin_or_bureau()) OR is_super_admin());

-- task_templates
DROP POLICY IF EXISTS "company_insert_templates" ON public.task_templates;
CREATE POLICY "company_insert_templates" ON public.task_templates FOR INSERT TO authenticated
WITH CHECK ((company_id = get_my_company_id() AND is_admin_or_bureau()) OR is_super_admin());

-- pdf_settings
DROP POLICY IF EXISTS "company_insert_pdf" ON public.pdf_settings;
CREATE POLICY "company_insert_pdf" ON public.pdf_settings FOR INSERT TO authenticated
WITH CHECK ((company_id = get_my_company_id() AND is_admin_or_bureau()) OR is_super_admin());

-- binomes
DROP POLICY IF EXISTS "company_insert_binomes" ON public.binomes;
CREATE POLICY "company_insert_binomes" ON public.binomes FOR INSERT TO authenticated
WITH CHECK ((company_id = get_my_company_id() AND is_admin_or_bureau()) OR is_super_admin());

-- Fix user_roles: restrict admin_manage_roles to same company
DROP POLICY IF EXISTS "admin_manage_roles" ON public.user_roles;
CREATE POLICY "admin_manage_roles" ON public.user_roles FOR ALL TO authenticated
USING (
  is_admin_or_bureau()
  AND role NOT IN ('admin', 'super_admin')
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = user_roles.user_id AND company_id = get_my_company_id())
)
WITH CHECK (
  is_admin_or_bureau()
  AND role NOT IN ('admin', 'super_admin')
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = user_roles.user_id AND company_id = get_my_company_id())
);

-- Fix storage: restrict photo/signature reads to company members
DROP POLICY IF EXISTS "Authenticated users can view intervention photos" ON storage.objects;
CREATE POLICY "Company members can view intervention photos" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'intervention-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR is_admin_or_bureau()
    OR is_super_admin()
  )
);

DROP POLICY IF EXISTS "Authenticated users can view signatures" ON storage.objects;
CREATE POLICY "Company members can view signatures" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'intervention-signatures'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR is_admin_or_bureau()
    OR is_super_admin()
  )
);
