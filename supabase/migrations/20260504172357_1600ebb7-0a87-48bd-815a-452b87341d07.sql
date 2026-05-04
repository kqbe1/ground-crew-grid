
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Helpers in private
CREATE OR REPLACE FUNCTION private.get_my_company_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT company_id FROM public.profiles WHERE id=auth.uid() $$;
CREATE OR REPLACE FUNCTION private.get_my_role() RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT role FROM public.profiles WHERE id=auth.uid() $$;
CREATE OR REPLACE FUNCTION private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT private.get_my_role()='admin' $$;
CREATE OR REPLACE FUNCTION private.is_bureau() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT private.get_my_role()='bureau' $$;
CREATE OR REPLACE FUNCTION private.is_ouvrier() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT private.get_my_role()='ouvrier' $$;
CREATE OR REPLACE FUNCTION private.is_super_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT private.get_my_role()='super_admin' $$;
CREATE OR REPLACE FUNCTION private.is_admin_or_bureau() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT private.get_my_role() IN ('admin','bureau') $$;
CREATE OR REPLACE FUNCTION private.is_admin_or_secretariat() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT private.get_my_role() IN ('admin','bureau') $$;
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id AND role=_role) $$;
CREATE OR REPLACE FUNCTION private.can_create_devis_db() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT COALESCE((SELECT can_create_devis FROM public.profiles WHERE id=auth.uid()),false) $$;
CREATE OR REPLACE FUNCTION private.storage_file_belongs_to_my_company(file_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=((storage.foldername(file_name))[1])::uuid AND company_id=private.get_my_company_id()) $$;
CREATE OR REPLACE FUNCTION private.get_my_profile_protected() RETURNS TABLE(role public.app_role,company_id uuid,is_active boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT p.role,p.company_id,p.is_active FROM public.profiles p WHERE p.id=auth.uid() $$;
CREATE OR REPLACE FUNCTION private.log_activity(p_action text,p_actor_id uuid DEFAULT NULL,p_target_type text DEFAULT NULL,p_target_id uuid DEFAULT NULL,p_company_id uuid DEFAULT NULL,p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.activity_logs(action,actor_id,target_type,target_id,company_id,metadata) VALUES(p_action,p_actor_id,p_target_type,p_target_id,p_company_id,p_metadata); END; $$;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.proname,pg_get_function_identity_arguments(p.oid) args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION private.%I(%s) FROM PUBLIC, anon',r.proname,r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION private.%I(%s) TO authenticated',r.proname,r.args);
  END LOOP;
END $$;

-- Update trigger functions to call private.*
CREATE OR REPLACE FUNCTION public.set_company_id() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NEW.company_id IS NULL THEN NEW.company_id:=private.get_my_company_id(); END IF; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.restrict_user_profile_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF private.is_super_admin() THEN RETURN NEW; END IF;
  IF private.is_admin() OR private.is_bureau() THEN
    IF OLD.role IN ('admin','super_admin') AND OLD.id!=auth.uid() THEN
      NEW.is_active:=OLD.is_active; NEW.worker_level:=OLD.worker_level; NEW.role:=OLD.role;
    END IF;
    IF OLD.id=auth.uid() THEN NEW.is_active:=OLD.is_active; NEW.role:=OLD.role; END IF;
    NEW.company_id:=OLD.company_id; RETURN NEW;
  END IF;
  NEW.worker_level:=OLD.worker_level; NEW.is_active:=OLD.is_active; NEW.role:=OLD.role; NEW.company_id:=OLD.company_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.restrict_ouvrier_task_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.is_ouvrier() THEN RETURN NEW; END IF;
  NEW.memo_secretariat:=OLD.memo_secretariat; NEW.assigned_to:=OLD.assigned_to; NEW.second_assigned_to:=OLD.second_assigned_to;
  NEW.client_id:=OLD.client_id; NEW.client_site_id:=OLD.client_site_id; NEW.equipment_id:=OLD.equipment_id;
  NEW.created_by:=OLD.created_by; NEW.intervention_type:=OLD.intervention_type; NEW.title:=OLD.title;
  NEW.scheduled_date:=OLD.scheduled_date; NEW.start_time:=OLD.start_time; NEW.duration_minutes:=OLD.duration_minutes; NEW.template_id:=OLD.template_id;
  RETURN NEW;
END; $$;

-- Recreate get_my_company_full + get_my_clients_safe as SECURITY INVOKER (relying on RLS)
DROP FUNCTION IF EXISTS public.get_my_company_full();
DROP FUNCTION IF EXISTS public.get_my_clients_safe();
CREATE FUNCTION public.get_my_company_full() RETURNS SETOF public.companies LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT * FROM public.companies $$;
CREATE FUNCTION public.get_my_clients_safe() RETURNS TABLE(id uuid,name text,phone text,email text,address_intervention text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT DISTINCT c.id,c.name,c.phone,c.email,c.address_intervention FROM public.clients c INNER JOIN public.work_tasks wt ON wt.client_id=c.id WHERE wt.assigned_to=auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_company_full() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_clients_safe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_company_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_clients_safe() TO authenticated;

-- ========= Rebuild RLS policies referencing private.* ==========

-- activity_logs
DROP POLICY IF EXISTS authenticated_insert_own_login_log ON public.activity_logs;
DROP POLICY IF EXISTS company_admin_select_logs ON public.activity_logs;
DROP POLICY IF EXISTS sa_insert_logs ON public.activity_logs;
DROP POLICY IF EXISTS sa_select_logs ON public.activity_logs;
CREATE POLICY authenticated_insert_own_login_log ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (action='login' AND actor_id=auth.uid() AND (company_id IS NULL OR company_id=private.get_my_company_id()));
CREATE POLICY company_admin_select_logs ON public.activity_logs FOR SELECT TO authenticated USING (company_id=private.get_my_company_id() AND private.is_admin_or_bureau());
CREATE POLICY sa_insert_logs ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (private.is_super_admin());
CREATE POLICY sa_select_logs ON public.activity_logs FOR SELECT TO authenticated USING (private.is_super_admin());

-- binomes
DROP POLICY IF EXISTS company_delete_binomes ON public.binomes;
DROP POLICY IF EXISTS company_insert_binomes ON public.binomes;
DROP POLICY IF EXISTS company_select_binomes ON public.binomes;
DROP POLICY IF EXISTS company_update_binomes ON public.binomes;
CREATE POLICY company_delete_binomes ON public.binomes FOR DELETE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));
CREATE POLICY company_insert_binomes ON public.binomes FOR INSERT TO authenticated WITH CHECK ((company_id=private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin());
CREATE POLICY company_select_binomes ON public.binomes FOR SELECT TO authenticated USING (company_id=private.get_my_company_id() OR private.is_super_admin());
CREATE POLICY company_update_binomes ON public.binomes FOR UPDATE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));

-- client_equipment
DROP POLICY IF EXISTS company_delete_client_equipment ON public.client_equipment;
DROP POLICY IF EXISTS company_insert_client_equipment ON public.client_equipment;
DROP POLICY IF EXISTS company_select_client_equipment ON public.client_equipment;
DROP POLICY IF EXISTS company_update_client_equipment ON public.client_equipment;
CREATE POLICY company_delete_client_equipment ON public.client_equipment FOR DELETE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));
CREATE POLICY company_insert_client_equipment ON public.client_equipment FOR INSERT TO authenticated WITH CHECK ((company_id=private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin());
CREATE POLICY company_select_client_equipment ON public.client_equipment FOR SELECT TO authenticated USING (company_id=private.get_my_company_id() OR private.is_super_admin());
CREATE POLICY company_update_client_equipment ON public.client_equipment FOR UPDATE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));

-- client_sites
DROP POLICY IF EXISTS company_delete_client_sites ON public.client_sites;
DROP POLICY IF EXISTS company_insert_client_sites ON public.client_sites;
DROP POLICY IF EXISTS company_select_client_sites ON public.client_sites;
DROP POLICY IF EXISTS company_update_client_sites ON public.client_sites;
CREATE POLICY company_delete_client_sites ON public.client_sites FOR DELETE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));
CREATE POLICY company_insert_client_sites ON public.client_sites FOR INSERT TO authenticated WITH CHECK ((company_id=private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin());
CREATE POLICY company_select_client_sites ON public.client_sites FOR SELECT TO authenticated USING (company_id=private.get_my_company_id() OR private.is_super_admin());
CREATE POLICY company_update_client_sites ON public.client_sites FOR UPDATE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));

-- clients
DROP POLICY IF EXISTS company_delete_clients ON public.clients;
DROP POLICY IF EXISTS company_insert_clients ON public.clients;
DROP POLICY IF EXISTS company_select_clients ON public.clients;
DROP POLICY IF EXISTS company_update_clients ON public.clients;
CREATE POLICY company_delete_clients ON public.clients FOR DELETE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));
CREATE POLICY company_insert_clients ON public.clients FOR INSERT TO authenticated WITH CHECK ((company_id=private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin());
CREATE POLICY company_select_clients ON public.clients FOR SELECT TO authenticated USING (company_id=private.get_my_company_id() OR private.is_super_admin());
CREATE POLICY company_update_clients ON public.clients FOR UPDATE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));

-- companies
DROP POLICY IF EXISTS member_view_company ON public.companies;
DROP POLICY IF EXISTS sa_delete_companies ON public.companies;
DROP POLICY IF EXISTS sa_insert_companies ON public.companies;
DROP POLICY IF EXISTS sa_select_companies ON public.companies;
DROP POLICY IF EXISTS sa_update_companies ON public.companies;
CREATE POLICY member_view_company ON public.companies FOR SELECT TO authenticated USING (id=private.get_my_company_id() OR private.is_super_admin());
CREATE POLICY sa_delete_companies ON public.companies FOR DELETE TO authenticated USING (private.is_super_admin());
CREATE POLICY sa_insert_companies ON public.companies FOR INSERT TO authenticated WITH CHECK (private.is_super_admin());
CREATE POLICY sa_select_companies ON public.companies FOR SELECT TO authenticated USING (private.is_super_admin());
CREATE POLICY sa_update_companies ON public.companies FOR UPDATE TO authenticated USING (private.is_super_admin());

-- intervention_sheets
DROP POLICY IF EXISTS company_delete_sheets ON public.intervention_sheets;
DROP POLICY IF EXISTS company_insert_sheets ON public.intervention_sheets;
DROP POLICY IF EXISTS company_select_sheets ON public.intervention_sheets;
DROP POLICY IF EXISTS company_update_sheets ON public.intervention_sheets;
CREATE POLICY company_delete_sheets ON public.intervention_sheets FOR DELETE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));
CREATE POLICY company_insert_sheets ON public.intervention_sheets FOR INSERT TO authenticated WITH CHECK ((company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR worker_id=auth.uid())) OR private.is_super_admin());
CREATE POLICY company_select_sheets ON public.intervention_sheets FOR SELECT TO authenticated USING ((company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR worker_id=auth.uid())) OR private.is_super_admin());
CREATE POLICY company_update_sheets ON public.intervention_sheets FOR UPDATE TO authenticated USING ((company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR worker_id=auth.uid())) OR private.is_super_admin());

-- maintenance_schedules
DROP POLICY IF EXISTS company_delete_maintenance ON public.maintenance_schedules;
DROP POLICY IF EXISTS company_insert_maintenance ON public.maintenance_schedules;
DROP POLICY IF EXISTS company_select_maintenance ON public.maintenance_schedules;
DROP POLICY IF EXISTS company_update_maintenance ON public.maintenance_schedules;
CREATE POLICY company_delete_maintenance ON public.maintenance_schedules FOR DELETE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));
CREATE POLICY company_insert_maintenance ON public.maintenance_schedules FOR INSERT TO authenticated WITH CHECK ((company_id=private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin());
CREATE POLICY company_select_maintenance ON public.maintenance_schedules FOR SELECT TO authenticated USING (company_id=private.get_my_company_id() OR private.is_super_admin());
CREATE POLICY company_update_maintenance ON public.maintenance_schedules FOR UPDATE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));

-- parts_orders
DROP POLICY IF EXISTS company_delete_orders ON public.parts_orders;
DROP POLICY IF EXISTS company_insert_orders ON public.parts_orders;
DROP POLICY IF EXISTS company_select_orders ON public.parts_orders;
DROP POLICY IF EXISTS company_update_orders ON public.parts_orders;
CREATE POLICY company_delete_orders ON public.parts_orders FOR DELETE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));
CREATE POLICY company_insert_orders ON public.parts_orders FOR INSERT TO authenticated WITH CHECK ((company_id=private.get_my_company_id() AND requested_by=auth.uid()) OR (private.is_admin_or_bureau() AND company_id=private.get_my_company_id()) OR private.is_super_admin());
CREATE POLICY company_select_orders ON public.parts_orders FOR SELECT TO authenticated USING ((company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR requested_by=auth.uid())) OR private.is_super_admin());
CREATE POLICY company_update_orders ON public.parts_orders FOR UPDATE TO authenticated USING ((company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR requested_by=auth.uid())) OR private.is_super_admin());

-- pdf_settings
DROP POLICY IF EXISTS company_insert_pdf ON public.pdf_settings;
DROP POLICY IF EXISTS company_select_pdf ON public.pdf_settings;
DROP POLICY IF EXISTS company_update_pdf ON public.pdf_settings;
CREATE POLICY company_insert_pdf ON public.pdf_settings FOR INSERT TO authenticated WITH CHECK ((company_id=private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin());
CREATE POLICY company_select_pdf ON public.pdf_settings FOR SELECT TO authenticated USING (company_id=private.get_my_company_id() OR private.is_super_admin());
CREATE POLICY company_update_pdf ON public.pdf_settings FOR UPDATE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));

-- platform_settings
DROP POLICY IF EXISTS sa_delete_settings ON public.platform_settings;
DROP POLICY IF EXISTS sa_insert_settings ON public.platform_settings;
DROP POLICY IF EXISTS sa_select_settings ON public.platform_settings;
DROP POLICY IF EXISTS sa_update_settings ON public.platform_settings;
CREATE POLICY sa_delete_settings ON public.platform_settings FOR DELETE TO authenticated USING (private.is_super_admin());
CREATE POLICY sa_insert_settings ON public.platform_settings FOR INSERT TO authenticated WITH CHECK (private.is_super_admin());
CREATE POLICY sa_select_settings ON public.platform_settings FOR SELECT TO authenticated USING (private.is_super_admin());
CREATE POLICY sa_update_settings ON public.platform_settings FOR UPDATE TO authenticated USING (private.is_super_admin());

-- profiles
DROP POLICY IF EXISTS admin_update_company_profiles ON public.profiles;
DROP POLICY IF EXISTS bureau_admin_update_own_display_order ON public.profiles;
DROP POLICY IF EXISTS company_view_profiles ON public.profiles;
DROP POLICY IF EXISTS own_update ON public.profiles;
DROP POLICY IF EXISTS sa_update_profiles ON public.profiles;
CREATE POLICY admin_update_company_profiles ON public.profiles FOR UPDATE TO authenticated USING (private.is_admin() AND company_id=private.get_my_company_id() AND id<>auth.uid());
CREATE POLICY bureau_admin_update_own_display_order ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid() AND private.is_admin_or_bureau()) WITH CHECK (id=auth.uid() AND private.is_admin_or_bureau());
CREATE POLICY company_view_profiles ON public.profiles FOR SELECT TO authenticated USING (company_id=private.get_my_company_id() OR private.is_super_admin());
CREATE POLICY own_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK (
  id=auth.uid()
  AND NOT (role IS DISTINCT FROM (SELECT r.role FROM private.get_my_profile_protected() r))
  AND NOT (company_id IS DISTINCT FROM (SELECT r.company_id FROM private.get_my_profile_protected() r))
  AND NOT (is_active IS DISTINCT FROM (SELECT r.is_active FROM private.get_my_profile_protected() r))
  AND NOT (can_create_devis IS DISTINCT FROM (SELECT p.can_create_devis FROM public.profiles p WHERE p.id=auth.uid()))
  AND NOT (worker_level IS DISTINCT FROM (SELECT p.worker_level FROM public.profiles p WHERE p.id=auth.uid()))
);
CREATE POLICY sa_update_profiles ON public.profiles FOR UPDATE TO authenticated USING (private.is_super_admin());

-- quotes
DROP POLICY IF EXISTS company_delete_quotes ON public.quotes;
DROP POLICY IF EXISTS company_insert_quotes ON public.quotes;
DROP POLICY IF EXISTS company_select_quotes ON public.quotes;
DROP POLICY IF EXISTS company_update_quotes ON public.quotes;
DROP POLICY IF EXISTS sa_all_quotes ON public.quotes;
CREATE POLICY company_delete_quotes ON public.quotes FOR DELETE TO authenticated USING (company_id=private.get_my_company_id() AND private.is_admin_or_bureau());
CREATE POLICY company_insert_quotes ON public.quotes FOR INSERT TO authenticated WITH CHECK (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR (created_by=auth.uid() AND private.can_create_devis_db())));
CREATE POLICY company_select_quotes ON public.quotes FOR SELECT TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR created_by=auth.uid()));
CREATE POLICY company_update_quotes ON public.quotes FOR UPDATE TO authenticated USING (company_id=private.get_my_company_id() AND private.is_admin_or_bureau());
CREATE POLICY sa_all_quotes ON public.quotes FOR ALL TO authenticated USING (private.is_super_admin()) WITH CHECK (private.is_super_admin());

-- task_templates
DROP POLICY IF EXISTS company_delete_templates ON public.task_templates;
DROP POLICY IF EXISTS company_insert_templates ON public.task_templates;
DROP POLICY IF EXISTS company_select_templates ON public.task_templates;
DROP POLICY IF EXISTS company_update_templates ON public.task_templates;
CREATE POLICY company_delete_templates ON public.task_templates FOR DELETE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));
CREATE POLICY company_insert_templates ON public.task_templates FOR INSERT TO authenticated WITH CHECK ((company_id=private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin());
CREATE POLICY company_select_templates ON public.task_templates FOR SELECT TO authenticated USING (company_id=private.get_my_company_id() OR private.is_super_admin());
CREATE POLICY company_update_templates ON public.task_templates FOR UPDATE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));

-- user_roles
DROP POLICY IF EXISTS admin_manage_roles ON public.user_roles;
DROP POLICY IF EXISTS admin_view_roles ON public.user_roles;
DROP POLICY IF EXISTS sa_all_roles ON public.user_roles;
DROP POLICY IF EXISTS view_own_role ON public.user_roles;
CREATE POLICY admin_manage_roles ON public.user_roles FOR ALL TO authenticated
  USING (private.is_admin() AND user_id<>auth.uid() AND role NOT IN ('admin','super_admin') AND EXISTS(SELECT 1 FROM public.profiles WHERE id=user_roles.user_id AND company_id=private.get_my_company_id()))
  WITH CHECK (private.is_admin() AND user_id<>auth.uid() AND role NOT IN ('admin','super_admin') AND EXISTS(SELECT 1 FROM public.profiles WHERE id=user_roles.user_id AND company_id=private.get_my_company_id()));
CREATE POLICY admin_view_roles ON public.user_roles FOR SELECT TO authenticated USING (private.is_admin_or_secretariat() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=user_roles.user_id AND company_id=private.get_my_company_id()));
CREATE POLICY sa_all_roles ON public.user_roles FOR ALL TO authenticated USING (private.is_super_admin());
CREATE POLICY view_own_role ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid());

-- work_tasks
DROP POLICY IF EXISTS company_delete_work_tasks ON public.work_tasks;
DROP POLICY IF EXISTS company_insert_work_tasks ON public.work_tasks;
DROP POLICY IF EXISTS company_select_work_tasks ON public.work_tasks;
DROP POLICY IF EXISTS company_update_work_tasks ON public.work_tasks;
CREATE POLICY company_delete_work_tasks ON public.work_tasks FOR DELETE TO authenticated USING (company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin()));
CREATE POLICY company_insert_work_tasks ON public.work_tasks FOR INSERT TO authenticated WITH CHECK ((company_id=private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin());
CREATE POLICY company_select_work_tasks ON public.work_tasks FOR SELECT TO authenticated USING ((company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR assigned_to=auth.uid() OR second_assigned_to=auth.uid())) OR private.is_super_admin());
CREATE POLICY company_update_work_tasks ON public.work_tasks FOR UPDATE TO authenticated USING ((company_id=private.get_my_company_id() AND (private.is_admin_or_bureau() OR assigned_to=auth.uid() OR second_assigned_to=auth.uid())) OR private.is_super_admin());

-- ========= storage.objects policies ==========
DROP POLICY IF EXISTS "Owner or admin can delete photos" ON storage.objects;
CREATE POLICY "Owner or admin can delete photos" ON storage.objects FOR DELETE TO public
  USING (bucket_id='intervention-photos' AND ((auth.uid())::text=(storage.foldername(name))[1] OR private.is_admin() OR private.is_super_admin()));

DROP POLICY IF EXISTS "Owner or admin can delete signatures" ON storage.objects;
CREATE POLICY "Owner or admin can delete signatures" ON storage.objects FOR DELETE TO public
  USING (bucket_id='intervention-signatures' AND ((auth.uid())::text=(storage.foldername(name))[1] OR private.is_admin() OR private.is_super_admin()));

DROP POLICY IF EXISTS "company_select_quote_assets" ON storage.objects;
CREATE POLICY "company_select_quote_assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='quote-assets' AND private.storage_file_belongs_to_my_company(name));

DROP POLICY IF EXISTS "company_delete_quote_assets" ON storage.objects;
CREATE POLICY "company_delete_quote_assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='quote-assets' AND ((private.storage_file_belongs_to_my_company(name) AND private.is_admin_or_bureau()) OR (storage.foldername(name))[1]=(auth.uid())::text));

DROP POLICY IF EXISTS "Company members can view intervention photos" ON storage.objects;
CREATE POLICY "Company members can view intervention photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='intervention-photos' AND ((auth.uid())::text=(storage.foldername(name))[1] OR (private.is_admin_or_bureau() AND private.storage_file_belongs_to_my_company(name)) OR private.is_super_admin()));

DROP POLICY IF EXISTS "Company members can view signatures" ON storage.objects;
CREATE POLICY "Company members can view signatures" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='intervention-signatures' AND ((auth.uid())::text=(storage.foldername(name))[1] OR (private.is_admin_or_bureau() AND private.storage_file_belongs_to_my_company(name)) OR private.is_super_admin()));

DROP POLICY IF EXISTS "Company admins can upload assets" ON storage.objects;
CREATE POLICY "Company admins can upload assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='company-assets' AND ((private.is_admin_or_bureau() AND (storage.foldername(name))[1]=(private.get_my_company_id())::text) OR private.is_super_admin()));

DROP POLICY IF EXISTS "Company admins can update assets" ON storage.objects;
CREATE POLICY "Company admins can update assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='company-assets' AND ((private.is_admin_or_bureau() AND (storage.foldername(name))[1]=(private.get_my_company_id())::text) OR private.is_super_admin()));

DROP POLICY IF EXISTS "Company admins can delete assets" ON storage.objects;
CREATE POLICY "Company admins can delete assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='company-assets' AND ((private.is_admin_or_bureau() AND (storage.foldername(name))[1]=(private.get_my_company_id())::text) OR private.is_super_admin()));

DROP POLICY IF EXISTS "Owner or company admin can update intervention photos" ON storage.objects;
CREATE POLICY "Owner or company admin can update intervention photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='intervention-photos' AND ((auth.uid())::text=(storage.foldername(name))[1] OR (private.is_admin_or_bureau() AND private.storage_file_belongs_to_my_company(name)) OR private.is_super_admin()));

DROP POLICY IF EXISTS "Owner or company admin can update intervention signatures" ON storage.objects;
CREATE POLICY "Owner or company admin can update intervention signatures" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='intervention-signatures' AND ((auth.uid())::text=(storage.foldername(name))[1] OR (private.is_admin_or_bureau() AND private.storage_file_belongs_to_my_company(name)) OR private.is_super_admin()));

DROP POLICY IF EXISTS "Scoped read company assets" ON storage.objects;
CREATE POLICY "Scoped read company assets" ON storage.objects FOR SELECT TO public
  USING (bucket_id='company-assets' AND ((storage.foldername(name))[1]=(private.get_my_company_id())::text OR private.is_super_admin()));

DROP POLICY IF EXISTS "company_update_quote_assets" ON storage.objects;
CREATE POLICY "company_update_quote_assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='quote-assets' AND ((private.is_admin_or_bureau() AND private.storage_file_belongs_to_my_company(name)) OR private.is_super_admin()));

DROP POLICY IF EXISTS "company_insert_quote_assets" ON storage.objects;
CREATE POLICY "company_insert_quote_assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='quote-assets' AND (storage.foldername(name))[1]=(auth.uid())::text AND (private.is_admin_or_bureau() OR private.can_create_devis_db()));

-- ========= Drop the old public helpers ==========
DROP FUNCTION IF EXISTS public.get_my_profile_protected();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_bureau();
DROP FUNCTION IF EXISTS public.is_ouvrier();
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.is_admin_or_bureau();
DROP FUNCTION IF EXISTS public.is_admin_or_secretariat();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.can_create_devis_db();
DROP FUNCTION IF EXISTS public.storage_file_belongs_to_my_company(text);
DROP FUNCTION IF EXISTS public.log_activity(text, uuid, text, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.get_my_company_id();
