import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Charge tous les ouvriers actifs et retourne :
 *  - labels: map id -> "T1", "T2"... (selon display_order)
 *  - names:  map id -> full_name
 */
export function useWorkerLabels() {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, display_order, is_active")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("full_name", { ascending: true });
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      const nm: Record<string, string> = {};
      data.forEach((w, i) => {
        map[w.id] = `T${i + 1}`;
        nm[w.id] = w.full_name;
      });
      setLabels(map);
      setNames(nm);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Backward compatible: callers using `const labels = useWorkerLabels()`
  // will still receive the labels map (proxy with extra `names` property).
  return Object.assign(labels, { __names: names }) as Record<string, string> & { __names: Record<string, string> };
}

export function workerLabel(labels: Record<string, string>, workerId?: string | null) {
  if (!workerId) return null;
  return labels[workerId] ?? null;
}