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
        .select("id, full_name, display_order, is_active, role, worker_level")
        .eq("is_active", true)
        .in("role", ["ouvrier", "admin"])
        .order("display_order", { ascending: true })
        .order("full_name", { ascending: true });
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      // Le label vient du worker_level assigné manuellement (T0..T5).
      // L'admin n'a pas de label numéroté.
      data.forEach((w: any) => {
        if (w.role !== "ouvrier") return;
        if (w.worker_level) map[w.id] = w.worker_level;
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