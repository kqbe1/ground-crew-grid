-- 1. Strict status flow: no skipping a step, no going back
CREATE OR REPLACE FUNCTION public.enforce_parts_order_status_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_idx int;
  new_idx int;
  steps text[] := ARRAY['demandee','commandee','recue','cloturee'];
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  old_idx := array_position(steps, OLD.status::text);
  new_idx := array_position(steps, NEW.status::text);
  IF old_idx IS NULL OR new_idx IS NULL THEN
    RETURN NEW;
  END IF;
  IF new_idx < old_idx THEN
    RAISE EXCEPTION 'Retour en arrière interdit sur le statut d''une commande (% -> %)', OLD.status, NEW.status;
  END IF;
  IF new_idx > old_idx + 1 THEN
    RAISE EXCEPTION 'Étape sautée interdite sur le statut d''une commande (% -> %)', OLD.status, NEW.status;
  END IF;
  IF new_idx >= 2 AND NEW.ordered_at IS NULL THEN NEW.ordered_at := now(); END IF;
  IF new_idx >= 3 AND NEW.received_at IS NULL THEN NEW.received_at := now(); END IF;
  IF new_idx >= 4 AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  RETURN NEW;
END;
$function$;

-- 2. A new order always starts at 'demandee'
CREATE OR REPLACE FUNCTION public.enforce_parts_order_initial_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM 'demandee'::order_status THEN
    RAISE EXCEPTION 'Une nouvelle commande doit être créée au statut « demandée »';
  END IF;
  NEW.ordered_at := NULL;
  NEW.received_at := NULL;
  NEW.closed_at := NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_parts_order_initial_status ON public.parts_orders;
CREATE TRIGGER trg_enforce_parts_order_initial_status
BEFORE INSERT ON public.parts_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_parts_order_initial_status();

-- 3. Update policy restricted to authenticated role (was PUBLIC)
DROP POLICY IF EXISTS company_update_orders ON public.parts_orders;
CREATE POLICY company_update_orders ON public.parts_orders
FOR UPDATE TO authenticated
USING (((company_id = private.get_my_company_id()) AND private.is_admin_or_bureau()) OR private.is_super_admin())
WITH CHECK (((company_id = private.get_my_company_id()) AND private.is_admin_or_bureau()) OR private.is_super_admin());

-- 4. Prevent duplicate pending request of the same part on the same task
CREATE UNIQUE INDEX IF NOT EXISTS parts_orders_unique_pending_part
ON public.parts_orders (work_task_id, lower(btrim(part_name)))
WHERE status = 'demandee' AND work_task_id IS NOT NULL;