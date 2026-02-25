import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DB_NAME = "pme-terrain-offline";
const DB_VERSION = 1;
const STORE_NAME = "draft_sheets";

export interface OfflineDraft {
  id: string; // local UUID
  work_task_id: string;
  worker_id: string;
  arrival_time: string | null;
  departure_time: string | null;
  description: string;
  final_status: string;
  client_present: boolean;
  client_absent: boolean;
  signature_data: string | null;
  signed_at: string | null;
  photos_before: string[] | null;
  photos_after: string[] | null;
  is_draft: boolean;
  created_at: string;
  synced: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllDrafts(): Promise<OfflineDraft[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDraft(draft: OfflineDraft): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteDraft(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function syncDraft(draft: OfflineDraft): Promise<boolean> {
  const { id, synced, created_at, ...payload } = draft;
  const { error } = await supabase.from("intervention_sheets").insert({
    ...payload,
    arrival_time: payload.arrival_time || null,
    departure_time: payload.departure_time || null,
    final_status: payload.final_status as any,
  });

  if (!error) {
    // Also update work_tasks status
    await supabase.from("work_tasks").update({ status: payload.final_status as any }).eq("id", payload.work_task_id);
    await deleteDraft(id);
    return true;
  }
  return false;
}

export function useOfflineDrafts() {
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshDrafts = useCallback(async () => {
    try {
      const all = await getAllDrafts();
      const unsynced = all.filter((d) => !d.synced);
      setDrafts(all);
      setPendingCount(unsynced.length);
    } catch {
      // IndexedDB might not be available
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (!navigator.onLine) return;
    const all = await getAllDrafts();
    const unsynced = all.filter((d) => !d.synced);
    if (unsynced.length === 0) return;

    setSyncing(true);
    let syncedCount = 0;
    for (const draft of unsynced) {
      const ok = await syncDraft(draft);
      if (ok) syncedCount++;
    }
    setSyncing(false);
    await refreshDrafts();
    return syncedCount;
  }, [refreshDrafts]);

  const syncAllRef = useRef(syncAll);
  syncAllRef.current = syncAll;

  // Listen for online/offline events — auto-sync on reconnect
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Small delay to let the network stabilise
      setTimeout(async () => {
        const all = await getAllDrafts();
        const pending = all.filter((d) => !d.synced).length;
        if (pending === 0) return;

        toast.info("Connexion rétablie — synchronisation…");
        const count = await syncAllRef.current();
        if (count && count > 0) {
          toast.success(`${count} fiche(s) synchronisée(s) automatiquement`);
        }
      }, 1500);
    };
    const goOffline = () => {
      setIsOnline(false);
      toast.warning("Connexion perdue — mode hors-ligne activé");
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    refreshDrafts();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refreshDrafts]);

  const save = useCallback(async (draft: Omit<OfflineDraft, "id" | "synced" | "created_at">) => {
    const fullDraft: OfflineDraft = {
      ...draft,
      id: crypto.randomUUID(),
      synced: false,
      created_at: new Date().toISOString(),
    };
    await saveDraft(fullDraft);

    // If online, try to sync immediately
    if (navigator.onLine) {
      const ok = await syncDraft(fullDraft);
      if (!ok) {
        await refreshDrafts();
        return { synced: false };
      }
      await refreshDrafts();
      return { synced: true };
    }

    await refreshDrafts();
    return { synced: false };
  }, [refreshDrafts]);

  return {
    drafts,
    pendingCount,
    syncing,
    isOnline,
    save,
    syncAll,
    refreshDrafts,
  };
}
