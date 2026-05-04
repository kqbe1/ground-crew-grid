
CREATE OR REPLACE FUNCTION public.list_security_definer_violations()
RETURNS TABLE(function_name text, arguments text, callable_by text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM private.list_security_definer_violations() $$;

REVOKE EXECUTE ON FUNCTION public.list_security_definer_violations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_security_definer_violations() TO service_role;
