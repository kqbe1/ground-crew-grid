
CREATE POLICY "authenticated_insert_own_login_log" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (action = 'login' AND actor_id = auth.uid());
