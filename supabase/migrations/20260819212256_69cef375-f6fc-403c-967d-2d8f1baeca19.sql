DROP POLICY IF EXISTS company_delete_maintenance ON public.maintenance_schedules;
CREATE POLICY company_delete_maintenance ON public.maintenance_schedules FOR DELETE TO authenticated
USING ((company_id = private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin());

DROP POLICY IF EXISTS company_update_maintenance ON public.maintenance_schedules;
CREATE POLICY company_update_maintenance ON public.maintenance_schedules FOR UPDATE TO authenticated
USING ((company_id = private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin())
WITH CHECK ((company_id = private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin());