import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invalidateQuotesCache } from "@/lib/quotesQuery";

interface Options {
  /** Nom unique du canal (évite les collisions). */
  channelName: string;
  /** Appelé à chaque event quotes ou après une reconnexion. */
  onChange: () => void;
}

/**
 * Abonnement Realtime robuste pour la table `quotes` :
 * - Invalide le cache devis et déclenche `onChange` à chaque event.
 * - Détecte les pertes de connexion (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`).
 * - Re-souscrit automatiquement avec backoff exponentiel (1s → 30s).
 * - Force un rechargement (cache vidé) à chaque reconnexion réussie pour
 *   rattraper les événements manqués pendant la coupure.
 */
export function useRealtimeQuotes({ channelName, onChange }: Options) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let wasDisconnected = false;

    const cleanup = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (channel) { supabase.removeChannel(channel); channel = null; }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      wasDisconnected = true;
      const delay = Math.min(30_000, 1_000 * 2 ** retry);
      retry += 1;
      timer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (cancelled) return;
      cleanup();
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "quotes" },
          () => {
            invalidateQuotesCache();
            onChangeRef.current();
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            retry = 0;
            // Rattrape les événements manqués si on revient d'une coupure.
            if (wasDisconnected) {
              wasDisconnected = false;
              invalidateQuotesCache();
              onChangeRef.current();
            }
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            scheduleReconnect();
          }
        });
    };

    // Reprise quand l'onglet redevient visible / le réseau revient.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        invalidateQuotesCache();
        onChangeRef.current();
        if (!channel) connect();
      }
    };
    const handleOnline = () => {
      retry = 0;
      connect();
    };

    connect();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      cleanup();
    };
  }, [channelName]);
}