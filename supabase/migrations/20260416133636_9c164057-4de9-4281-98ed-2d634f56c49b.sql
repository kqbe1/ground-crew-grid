
-- Drop the recursive policy
DROP POLICY IF EXISTS "own_update" ON public.profiles;

-- Recreate with simple check — the trigger restrict_user_profile_update
-- already prevents users from changing role, company_id, is_active
CREATE POLICY "own_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
