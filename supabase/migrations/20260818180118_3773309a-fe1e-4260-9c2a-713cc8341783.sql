REVOKE ALL ON FUNCTION public.validate_parts_order_refs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_parts_order_status_flow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_task_status_on_part_received() FROM PUBLIC, anon, authenticated;