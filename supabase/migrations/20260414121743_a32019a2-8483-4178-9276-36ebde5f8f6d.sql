
DROP POLICY IF EXISTS "company_insert_orders" ON public.parts_orders;

CREATE POLICY "company_insert_orders"
ON public.parts_orders
FOR INSERT
TO authenticated
WITH CHECK (
  (
    (company_id = get_my_company_id()) AND (requested_by = auth.uid())
  )
  OR
  (
    is_admin_or_bureau() AND (company_id = get_my_company_id())
  )
  OR
  is_super_admin()
);
