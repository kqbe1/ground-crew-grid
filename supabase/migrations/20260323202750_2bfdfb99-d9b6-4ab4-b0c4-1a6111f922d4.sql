
-- Fix intervention_sheets INSERT policy
DROP POLICY "Authenticated can insert sheets" ON public.intervention_sheets;
CREATE POLICY "Authenticated can insert sheets" ON public.intervention_sheets
  FOR INSERT WITH CHECK (
    worker_id = auth.uid() OR public.is_admin_or_secretariat()
  );

-- Fix parts_orders INSERT policy
DROP POLICY "Authenticated can insert orders" ON public.parts_orders;
CREATE POLICY "Authenticated can insert orders" ON public.parts_orders
  FOR INSERT WITH CHECK (
    requested_by = auth.uid() OR public.is_admin_or_secretariat()
  );
