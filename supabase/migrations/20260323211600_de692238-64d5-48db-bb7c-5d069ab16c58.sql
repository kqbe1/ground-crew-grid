-- Tighten parts_orders INSERT to require a role
DROP POLICY "Authenticated can insert orders" ON public.parts_orders;
CREATE POLICY "Role-holder can insert orders" ON public.parts_orders
  FOR INSERT WITH CHECK ((is_ouvrier() AND requested_by = auth.uid()) OR is_admin_or_secretariat());

-- Tighten intervention_sheets INSERT to require a role
DROP POLICY "Authenticated can insert sheets" ON public.intervention_sheets;
CREATE POLICY "Role-holder can insert sheets" ON public.intervention_sheets
  FOR INSERT WITH CHECK ((is_ouvrier() AND worker_id = auth.uid()) OR is_admin_or_secretariat());