import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Charge tous les ouvriers actifs et retourne une map id -> "T1", "T2"...
 * basée sur leur display_order (puis full_name).
 */
export function useWorkerLabels() {
  const [labels, setLabels] = useState<Record<string, string>>({});

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
      data.forEach((w, i) => {
        map[w.id] = `T${i + 1}`;
      });
      setLabels(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return labels;
}

export function workerLabel(labels: Record<string, string>, workerId?: string | null) {
  if (!workerId) return null;
  return labels[workerId] ?? null;
}