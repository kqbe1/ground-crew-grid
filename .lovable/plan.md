## Problème

Le lien `preview--ground-crew-grid.lovable.app` continue d'afficher l'ancien comportement (cards qui naviguent) malgré republication + hard refresh.

Cause identifiée : le projet embarque `vite-plugin-pwa` (`vite.config.ts`) avec `registerType: "autoUpdate"`, `display: "standalone"` et un cache Workbox qui inclut un `NetworkFirst` sur Supabase + cache de tous les `js/css/html`. Une fois enregistré sur les appareils, ce service worker continue de servir l'ancien shell HTML/JS depuis le cache, peu importe les republications. Hard refresh navigateur n'efface pas un service worker déjà installé.

## Correctif — "Rapide et sûr"

Neutraliser complètement la PWA web (mobile Capacitor non impacté : Capacitor n'utilise pas ce SW), via le pattern kill-switch recommandé.

### Étapes

1. **Retirer `vite-plugin-pwa` de `vite.config.ts`**
   - Supprimer l'import `VitePWA`.
   - Supprimer le bloc `VitePWA({...})` du tableau `plugins`.
   - Garder le reste (alias, manualChunks, componentTagger) inchangé.

2. **Désinstaller la dépendance**
   - `bun remove vite-plugin-pwa` pour nettoyer le lockfile.

3. **Ajouter un service worker "kill-switch"** dans `public/sw.js` qui :
   - `skipWaiting` + `clients.claim`
   - vide tous les `caches`
   - force chaque client à recharger l'URL avec un paramètre `?sw-cleanup=...`
   - puis `self.registration.unregister()`
   
   (Ce SW remplace l'ancien `sw.js` généré par Workbox, donc tous les appareils déjà enregistrés vont automatiquement l'installer au prochain check, se nettoyer et se désinscrire.)

4. **Conserver `public/manifest.webmanifest` simple si présent** (installable iOS/Android continuera de fonctionner sans SW, juste sans offline).

### Conséquences

- Plus de cache stale : la version publiée affichera désormais la dernière build (cards = filtres, sidebar, etc.).
- Les utilisateurs ayant l'app installée verront un rechargement automatique au prochain ouvrage, puis recevront chaque future build via HTML normal.
- L'offline web disparaît temporairement (mobile Capacitor offline-first reste intact car géré séparément via IndexedDB).
- Aucune autre logique métier ne change.

### Après publication

Après que je pousse le code, il faudra :
1. Cliquer **Publish → Update** dans Lovable.
2. Recharger une fois la page publiée — le kill-switch s'installe et recharge automatiquement.
3. Au second chargement, l'app sert la dernière version sans SW.

## Fichiers modifiés

- `vite.config.ts` (suppression PWA)
- `package.json` / `bun.lock` (via `bun remove`)
- `public/sw.js` (nouveau, kill-switch)
