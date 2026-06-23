import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadPhotos, uploadSignature } from "@/lib/storageUpload";

const DB_NAME = "pme-terrain-offline";
const DB_VERSION = 2;
const STORE_NAME = "draft_sheets";

export interface OfflineDraft {
  id: string;
  work_task_id: string;
  worker_id: string;
  /** Full intervention_sheets insert payload */
  payload: Record<string, any>;
  final_status: string;
  synced: boolean;
  created_at: string;
}

export type DraftSyncState = "pending" | "syncing" | "synced" | "error";

export interface DraftStatus {
  state: DraftSyncState;
  error?: string;
  updated_at: string;
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

/** Upload base64 media inside a payload before syncing */
async function uploadPayloadMedia(payload: Record<string, any>, workerId: string): Promise<Record<string, any>> {
  const p = { ...payload };
  try {
    const photoFields = ["photos_before", "photos_after", "photos_nameplate", "internal_photos"];
    for (const field of photoFields) {
      if (Array.isArray(p[field]) && p[field].length > 0 && typeof p[field][0] === "string" && p[field][0].startsWith("data:")) {
        p[field] = await uploadPhotos(p[field], workerId);
      }
    }
    if (p.signature_data && typeof p.signature_data === "string" && p.signature_data.startsWith("data:")) {
      p.signature_data = await uploadSignature(p.signature_data, workerId);
    }
  } catch (err) {
    console.error("Storage upload during sync failed:", err);
  }
  return p;
}

async function syncDraft(draft: OfflineDraft): Promise<{ ok: boolean; error?: string }> {
  try {
    const uploaded = await uploadPayloadMedia(draft.payload, draft.worker_id);
    const { error } = await supabase.from("intervention_sheets").insert(uploaded as any);
    if (error) {
      console.error("Sync draft error:", error);
      return { ok: false, error: error.message };
    }
    const { error: taskErr } = await supabase
      .from("work_tasks")
      .update({ status: draft.final_status as any })
      .eq("id", draft.work_task_id);
    if (taskErr) {
      console.error("Sync task status error:", taskErr);
    }
    await deleteDraft(draft.id);
    return { ok: true };
  } catch (err: any) {
    console.error("Sync draft exception:", err);
    return { ok: false, error: err?.message ?? "Erreur inconnue" };
  }
}

export function useOfflineDrafts() {
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusMap, setStatusMap] = useState<Record<string, DraftStatus>>({});

  const setDraftStatus = useCallback((id: string, status: DraftStatus) => {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  }, []);

  const refreshDrafts = useCallback(async () => {
    try {
      const all = await getAllDrafts();
      const unsynced = all.filter((d) => !d.synced);
      setDrafts(all);
      setPendingCount(unsynced.length);
      // Initialize "pending" status for any draft without a tracked state
      setStatusMap((prev) => {
        const next = { ...prev };
        for (const d of unsynced) {
          if (!next[d.id] || next[d.id].state === "synced") {
            next[d.id] = { state: "pending", updated_at: new Date().toISOString() };
          }
        }
        // Drop status entries for drafts that no longer exist
        for (const id of Object.keys(next)) {
          if (!all.find((d) => d.id === id)) delete next[id];
        }
        return next;
      });
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
      setDraftStatus(draft.id, { state: "syncing", updated_at: new Date().toISOString() });
      const result = await syncDraft(draft);
      if (result.ok) {
        setDraftStatus(draft.id, { state: "synced", updated_at: new Date().toISOString() });
        syncedCount++;
      } else {
        setDraftStatus(draft.id, { state: "error", error: result.error, updated_at: new Date().toISOString() });
      }
    }
    setSyncing(false);
    await refreshDrafts();
    return syncedCount;
  }, [refreshDrafts, setDraftStatus]);

  const retryDraft = useCallback(async (id: string) => {
    if (!navigator.onLine) {
      toast.error("Pas de connexion réseau");
      return false;
    }
    const all = await getAllDrafts();
    const draft = all.find((d) => d.id === id);
    if (!draft) return false;
    setDraftStatus(id, { state: "syncing", updated_at: new Date().toISOString() });
    const result = await syncDraft(draft);
    if (result.ok) {
      setDraftStatus(id, { state: "synced", updated_at: new Date().toISOString() });
      toast.success("Fiche synchronisée");
    } else {
      setDraftStatus(id, { state: "error", error: result.error, updated_at: new Date().toISOString() });
      toast.error(result.error ?? "Échec de la synchronisation");
    }
    await refreshDrafts();
    return result.ok;
  }, [refreshDrafts, setDraftStatus]);

  const discardDraft = useCallback(async (id: string) => {
    await deleteDraft(id);
    await refreshDrafts();
    toast.info("Brouillon supprimé");
  }, [refreshDrafts]);

  const syncAllRef = useRef(syncAll);
  syncAllRef.current = syncAll;

  useEffect(() => {
    const attemptSync = async (announce: boolean) => {
      if (!navigator.onLine) return;
      const all = await getAllDrafts();
      const pending = all.filter((d) => !d.synced).length;
      if (pending === 0) return;
      if (announce) toast.info(`Synchronisation de ${pending} fiche(s) en attente…`);
      const count = await syncAllRef.current();
      if (count && count > 0) {
        toast.success(`${count} fiche(s) synchronisée(s) automatiquement`);
      }
    };

    const goOnline = () => {
      setIsOnline(true);
      setTimeout(() => attemptSync(true), 1500);
    };
    const goOffline = () => {
      setIsOnline(false);
      toast.warning("Connexion perdue — mode hors-ligne activé");
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setIsOnline(navigator.onLine);
        attemptSync(false);
      }
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    refreshDrafts();
    // On mount, try syncing any leftover drafts from a previous session
    attemptSync(true);
    // Periodic safety net (mobile browsers sometimes miss the 'online' event)
    const interval = window.setInterval(() => attemptSync(false), 60_000);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
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
    setDraftStatus(fullDraft.id, { state: "pending", updated_at: new Date().toISOString() });

    if (navigator.onLine) {
      setDraftStatus(fullDraft.id, { state: "syncing", updated_at: new Date().toISOString() });
      const result = await syncDraft(fullDraft);
      if (!result.ok) {
        setDraftStatus(fullDraft.id, { state: "error", error: result.error, updated_at: new Date().toISOString() });
        await refreshDrafts();
        return { synced: false, error: result.error };
      }
      setDraftStatus(fullDraft.id, { state: "synced", updated_at: new Date().toISOString() });
      await refreshDrafts();
      return { synced: true };
    }

    await refreshDrafts();
    return { synced: false };
  }, [refreshDrafts, setDraftStatus]);

  return { drafts, pendingCount, syncing, isOnline, save, syncAll, refreshDrafts, statusMap, retryDraft, discardDraft };
}
