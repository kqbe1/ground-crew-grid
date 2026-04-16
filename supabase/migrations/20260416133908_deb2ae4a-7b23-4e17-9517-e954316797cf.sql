
-- Create a security definer function to read protected fields without recursion
CREATE OR REPLACE FUNCTION public.get_my_profile_protected()
RETURNS TABLE(role app_role, company_id uuid, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role, p.company_id, p.is_active
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

-- Replace the policy with column-level protection
DROP POLICY IF EXISTS "own_update" ON public.profiles;

CREATE POLICY "own_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role IS NOT DISTINCT FROM (SELECT r.role FROM public.get_my_profile_protected() r)
  AND company_id IS NOT DISTINCT FROM (SELECT r.company_id FROM public.get_my_profile_protected() r)
  AND is_active IS NOT DISTINCT FROM (SELECT r.is_active FROM public.get_my_profile_protected() r)
);
