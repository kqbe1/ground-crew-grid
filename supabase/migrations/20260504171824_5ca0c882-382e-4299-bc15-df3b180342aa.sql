-- Revoke direct EXECUTE on trigger-only SECURITY DEFINER functions.
-- Triggers run with the function owner's privileges regardless of GRANTs,
-- so revoking EXECUTE from PUBLIC/anon/authenticated does NOT break triggers.

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.set_company_id()',
    'public.handle_new_user()',
    'public.sync_user_role()',
    'public.restrict_user_profile_update()',
    'public.restrict_ouvrier_task_update()',
    'public.log_company_changes()',
    'public.log_profile_changes()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END
$$;