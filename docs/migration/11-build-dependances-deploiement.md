# 11 — Build, dépendances, PWA et déploiement Vercel

## 1. Stack technique

| Élément | Version / valeur |
|---|---|
| Framework | React 18.3 + TypeScript 5.8 |
| Bundler | Vite 5.4 (`@vitejs/plugin-react-swc`) |
| Styles | Tailwind CSS 3.4 + `tailwindcss-animate` + `@tailwindcss/typography` |
| Composants | shadcn/ui (Radix UI) |
| Routage | react-router-dom 6.30 (`BrowserRouter`) |
| Données | `@tanstack/react-query` 5.83 + `@supabase/supabase-js` 2.97 |
| Formulaires | react-hook-form 7.61 + zod 3.25 |
| PDF | jspdf 4.2 · ZIP : jszip 3.10 |
| Graphiques | recharts 2.15 |
| PWA | `vite-plugin-pwa` 1.2 (Workbox) |
| Mobile natif | Capacitor 8.3 (android, ios, push-notifications) |
| Tests | Vitest 3.2 + Testing Library + jsdom |
| Backend | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions Deno) |

Scripts : `dev`, `build`, `build:dev`, `lint`, `preview`, `test`, `test:watch`.
Sortie de build : `dist/`. Aucun `vercel.json` n'existe aujourd'hui.

## 2. Dépendances spécifiques à Lovable

| Paquet | Type | Rôle | Action migration |
|---|---|---|---|
| `lovable-tagger` | devDependency | Marquage des composants pour l'éditeur visuel, actif **uniquement en `mode === "development"`** | **Supprimer** : retirer l'import et la ligne du tableau `plugins` dans `vite.config.ts`, puis désinstaller |
| `@lovable.dev/vite-plugin-dev-server-bridge` | devDependency | Passerelle serveur de dev Lovable | **Supprimer** (non référencé dans `vite.config.ts`) |
| `@lovable.dev/vite-plugin-hmr-gate` | devDependency | Contrôle du HMR dans l'éditeur | **Supprimer** (non référencé dans `vite.config.ts`) |
| `npm:@lovable.dev/email-js` | edge function | Envoi d'e-mails (`process-email-queue`) | **À remplacer** par le SDK du nouveau fournisseur |
| `npm:@lovable.dev/webhooks-js` | edge function | Vérification HMAC (`handle-email-suppression`) | **À réécrire** en HMAC-SHA256 générique |

⚠️ Ces suppressions sont sans risque pour la production (les trois plugins Vite ne s'activent qu'en développement), mais **`vite.config.ts` doit être modifié avant de désinstaller `lovable-tagger`**, sinon le build échoue sur un import manquant.

Aucune autre dépendance propriétaire n'a été trouvée dans `src/` : le frontend est entièrement portable.

## 3. PWA et mobile

- Manifeste défini dans `vite.config.ts` : nom « PME Terrain », `start_url: "/mobile"`, `display: standalone`, `orientation: portrait`, thème `#1e40af`, icônes 192/512 (+ maskable) présentes dans `public/`.
- Stratégie Workbox : `autoUpdate`, précache des assets buildés, `NetworkFirst` (1 h, 50 entrées, timeout 5 s) pour `*/rest/v1/*` de Supabase, `CacheFirst` (1 an) pour Google Fonts.
- ⚠️ Le `runtimeCaching` Supabase utilise une regex générique `^https:\/\/.*supabase.*\/rest\/v1\/.*` : elle continuera de fonctionner avec la nouvelle référence de projet. En revanche, après changement de projet, **les anciennes réponses en cache doivent être purgées** — le `registerType: autoUpdate` s'en charge au premier déploiement, mais prévoir un message aux utilisateurs si des données obsolètes apparaissent.
- Hors-ligne : les brouillons sont stockés en **localStorage** (`src/lib/draftStorage.ts`, `localFicheDrafts.ts`) et synchronisés par `useOfflineDrafts.ts`. Rien à migrer côté serveur, mais **les brouillons en cours chez les ouvriers au moment du basculement seront conservés** (même origine si le domaine ne change pas) ou **perdus** si le domaine change — localStorage est lié à l'origine. 🔴 **Action** : demander aux ouvriers de finaliser et envoyer leurs fiches **avant** la bascule de domaine.
- Capacitor : `appId` et `server.url` pointent vers Lovable (voir doc 05). Aucune application n'est publiée à ce jour — **À VÉRIFIER** avec l'utilisateur ; si des APK ont été distribués manuellement, ils continueront de charger l'URL Lovable et devront être réinstallés.

## 4. Déploiement Vercel — configuration cible

### 4.1 Réglages du projet
| Paramètre | Valeur |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Node | 20 ou 22 |

### 4.2 Variables d'environnement à créer (Production **et** Preview)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Rappel : elles sont lues **au build**. Toute modification exige un **redéploiement**, un simple redémarrage ne suffit pas.

### 4.3 Fichier `vercel.json` à créer

Le routage SPA est indispensable : sans réécriture, `/planning` ou `/mobile/fiches` renvoient 404 au rafraîchissement.

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
    }
  ]
}
```
⚠️ Ne **pas** appliquer de cache long sur `index.html` ni sur `sw.js`, sinon les mises à jour de la PWA ne se propagent pas.

### 4.4 Domaine personnalisé
1. Ajouter le domaine dans Vercel, configurer les enregistrements DNS chez le registrar.
2. Attendre l'émission du certificat TLS.
3. Mettre à jour dans Supabase Auth : **Site URL** et **Redirect URLs** (domaine racine + `www` si utilisé + domaines de preview Vercel si l'on veut pouvoir s'y connecter).
4. Mettre à jour `capacitor.config.ts` si l'app native est conservée.
5. Mettre à jour les liens présents dans les templates d'e-mail.
6. ⚠️ Le sous-domaine d'envoi d'e-mails `notify.agchauffage.be` est aujourd'hui **délégué aux nameservers de Lovable** : sa reconfiguration DNS (SPF/DKIM/DMARC) chez le nouveau fournisseur est une étape à part entière (doc 07).

### 4.5 CORS
Les edge functions renvoient des en-têtes CORS permissifs (`*`). Cela reste fonctionnel après changement de domaine. **Recommandation** : restreindre à l'origine du domaine final une fois la migration stabilisée.

## 5. Qualité du code — points relevés

- `tsconfig.app.json` : `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`. Le typage est donc **permissif** ; des erreurs latentes ne sont pas détectées. Activer `strict` après migration serait bénéfique mais générera un volume important de corrections — à planifier séparément, **pas pendant la migration**.
- Tests : seulement 3 fichiers (`example.test.ts`, `setup.ts`, `syncDraft.test.ts`) plus 2 tests Deno pour `create-user`. **La couverture est quasi nulle** : la migration ne peut pas s'appuyer sur les tests automatiques, il faudra une recette manuelle (voir doc 10).
- Code mort identifié : `signUp()` dans `useAuth.tsx`, `public/placeholder.svg`, tables obsolètes en base (doc 03).
