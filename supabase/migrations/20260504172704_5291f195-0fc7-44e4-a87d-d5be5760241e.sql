
-- Fonction qui reproduit la règle 0029 du linter Supabase :
-- liste les SECURITY DEFINER de `public` exécutables par anon / authenticated / PUBLIC.
CREATE OR REPLACE FUNCTION private.list_security_definer_violations()
RETURNS TABLE(function_name text, arguments text, callable_by text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    n.nspname || '.' || p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    string_agg(r.rolname, ',' ORDER BY r.rolname) AS callable_by
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL (VALUES ('anon'),('authenticated'),('public')) AS roles(rolname)
  JOIN pg_roles r ON r.rolname = roles.rolname
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND has_function_privilege(r.oid, p.oid, 'EXECUTE')
  GROUP BY n.nspname, p.proname, p.oid
$$;

REVOKE EXECUTE ON FUNCTION private.list_security_definer_violations() FROM PUBLIC, anon, authenticated;
-- Only callable by service_role (used by the monitor edge function)
GRANT EXECUTE ON FUNCTION private.list_security_definer_violations() TO service_role;
GRANT USAGE ON SCHEMA private TO service_role;
