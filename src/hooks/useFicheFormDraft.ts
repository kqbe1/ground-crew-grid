import { useEffect, useRef, useState } from "react";

/**
 * Persistance du brouillon d'un formulaire de fiche mobile dans localStorage,
 * pour qu'il survive aux navigations entre écrans (et même au refresh).
 *
 * - `key` doit être unique par fiche (ex: `fiche-intervention:${taskId}`).
 * - `state` est l'objet complet (toutes les valeurs du formulaire + step).
 * - Au montage, on charge la version persistée s'il y en a une.
 * - À chaque changement de `state`, on écrit dans localStorage (debounce léger).
 * - `clear()` supprime le brouillon (à appeler après submit réussi).
 */
export function useFicheFormDraft<T extends Record<string, any>>(
  key: string,
  initial: T,
): [T, (updater: Partial<T> | ((prev: T) => T)) => void, () => void] {
  const storageKey = `fiche_draft:${key}`;

  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...initial, ...parsed };
      }
    } catch {
      // ignore
    }
    return initial;
  });

  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // quota or other — ignore silently
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [state, storageKey]);

  const update = (updater: Partial<T> | ((prev: T) => T)) => {
    setState((prev) =>
      typeof updater === "function" ? (updater as (p: T) => T)(prev) : { ...prev, ...updater },
    );
  };

  const clear = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  return [state, update, clear];
}