-- 1. Cohérence des références (isolation multi-entreprise) sur les commandes de pièces
CREATE OR REPLACE FUNCTION public.validate_parts_order_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_company uuid;
  t_client uuid;
  c_company uuid;
BEGIN
  IF NEW.work_task_id IS NOT NULL THEN
    SELECT company_id, client_id INTO t_company, t_client FROM public.work_tasks WHERE id = NEW.work_task_id;
    IF t_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'La tâche liée appartient à une autre entreprise';
    END IF;
    IF NEW.client_id IS NULL THEN
      NEW.client_id := t_client;
    END IF;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    SELECT company_id INTO c_company FROM public.clients WHERE id = NEW.client_id;
    IF c_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Le client lié appartient à une autre entreprise';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_parts_order_refs ON public.parts_orders;
CREATE TRIGGER trg_validate_parts_order_refs
BEFORE INSERT OR UPDATE ON public.parts_orders
FOR EACH ROW EXECUTE FUNCTION public.validate_parts_order_refs();

-- 2. Transitions de statut cohérentes (pas de retour en arrière)
CREATE OR REPLACE FUNCTION public.enforce_parts_order_status_flow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- horodatage cohérent, sans écraser une valeur existante
  IF new_idx >= 2 AND NEW.ordered_at IS NULL THEN NEW.ordered_at := now(); END IF;
  IF new_idx >= 3 AND NEW.received_at IS NULL THEN NEW.received_at := now(); END IF;
  IF new_idx >= 4 AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_parts_order_status_flow ON public.parts_orders;
CREATE TRIGGER trg_enforce_parts_order_status_flow
BEFORE UPDATE ON public.parts_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_parts_order_status_flow();

-- 3. Cohérence statut tâche <-> commande : pièce reçue => la tâche n'est plus bloquée
CREATE OR REPLACE FUNCTION public.sync_task_status_on_part_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.work_task_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status::text NOT IN ('recue','cloturee') THEN RETURN NEW; END IF;
  IF OLD.status::text = NEW.status::text THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.parts_orders o
    WHERE o.work_task_id = NEW.work_task_id
      AND o.id <> NEW.id
      AND o.status::text IN ('demandee','commandee')
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.work_tasks
  SET status = 'a_replanifier'
  WHERE id = NEW.work_task_id AND status = 'piece_a_commander';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_status_on_part_received ON public.parts_orders;
CREATE TRIGGER trg_sync_task_status_on_part_received
AFTER UPDATE ON public.parts_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_task_status_on_part_received();

REVOKE EXECUTE ON FUNCTION public.validate_parts_order_refs() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_parts_order_status_flow() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_task_status_on_part_received() FROM anon, authenticated;