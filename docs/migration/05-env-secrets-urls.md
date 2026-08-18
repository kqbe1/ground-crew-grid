# 05 — Variables d'environnement, secrets et URLs

> Aucune valeur réelle de secret n'est reproduite ici. Seuls les noms sont listés.

## 1. Variables frontend (build Vite)

Fichier `.env` à la racine, injecté **au moment du build** (`import.meta.env`). Ces valeurs finissent dans le bundle JavaScript : elles sont **publiques par nature**.

| Variable | Rôle | Portée | Secret ? | Utilisée dans | Après migration |
|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | URL de l'API Supabase | Frontend (build) | Non (publique) | `src/integrations/supabase/client.ts`, `CreateUserDialog.tsx`, `EditUserDialog.tsx`, `AdminUsersTab.tsx`, `SuperAdminUsers.tsx`, `Unsubscribe.tsx` | **À recréer dans Vercel** avec l'URL du projet Supabase cible |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé anon/publishable | Frontend (build) | Non (publique, protégée par RLS) | mêmes fichiers | **À recréer dans Vercel** avec la clé du projet cible |
| `VITE_SUPABASE_PROJECT_ID` | Référence du projet | Frontend (build) | Non | Présente dans `.env`, **aucune utilisation trouvée dans `src/`** | Optionnelle — peut être abandonnée |

⚠️ Le fichier `.env` est généré par Lovable Cloud. Après migration il faudra le maintenir manuellement en local (et le garder hors du dépôt Git) et déclarer les mêmes variables dans Vercel pour **Production** et **Preview**.

⚠️ Le client Supabase ne comporte **aucune garde** si ces variables sont absentes : le build réussit et l'application se casse silencieusement à l'exécution. Ajouter un contrôle explicite est recommandé.

## 2. Secrets backend (edge functions)

Injectés par la plateforme Supabase dans le runtime Deno (`Deno.env.get`).

| Secret | Rôle | Portée | Secret ? | Utilisé par | Après migration |
|---|---|---|---|---|---|
| `SUPABASE_URL` | URL du projet | Backend | Non | toutes les fonctions | Fourni automatiquement par Supabase |
| `SUPABASE_ANON_KEY` | Clé publique | Backend | Non | fonctions validant un JWT utilisateur | Automatique |
| `SUPABASE_SERVICE_ROLE_KEY` | Accès total base, contourne la RLS | Backend | **OUI — critique** | `create-user`, `update-user`, `cleanup-orphan-auth`, `security-monitor`, `process-email-queue`, `send-push`, `send-entretien-reminders` | Automatique dans le projet cible ; **ne jamais exposer côté client** |
| `SUPABASE_DB_URL` | Chaîne de connexion Postgres | Backend | **OUI** | usage interne | Automatique |
| `SUPABASE_JWKS` | Clés de vérification JWT | Backend | Non | validation de jeton | Automatique |
| `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` | Nouvelles clés API Supabase | Backend | partiellement | plateforme | Automatique |
| `LOVABLE_API_KEY` | Accès à Lovable AI Gateway (Gemini) | Backend | **OUI** | `analyze-nameplate` (analyse de plaque signalétique) | 🔴 **Dépendance Lovable** : disparaît hors Lovable. À remplacer par une clé Google Gemini / OpenAI propre |
| `LOVABLE_SEND_URL` | Endpoint d'envoi d'e-mails Lovable | Backend | Oui | `process-email-queue` | 🔴 **Dépendance Lovable** : à remplacer par Resend / Postmark / SES |
| `FCM_SERVER_KEY` | Clé serveur Firebase Cloud Messaging | Backend | **OUI** | `send-push` | À créer côté Firebase et à réenregistrer (n'apparaît pas dans la liste des secrets configurés → **la fonction push n'est probablement pas opérationnelle**) |
| `email_queue_service_role_key` (dans `vault`) | Jeton utilisé par les fonctions SQL `email_queue_dispatch()` / `email_queue_wake()` pour appeler l'edge function via `pg_net` | Base de données | **OUI** | file d'e-mails | **À recréer dans le vault du projet cible** — sinon la file d'e-mails ne part jamais |

## 3. Secrets absents mais nécessaires après migration

| Secret à créer | Pourquoi |
|---|---|
| Clé du fournisseur d'e-mails (ex. `RESEND_API_KEY`) | Remplacer `LOVABLE_SEND_URL` |
| Clé IA (ex. `GEMINI_API_KEY` ou `OPENAI_API_KEY`) | Remplacer `LOVABLE_API_KEY` pour `analyze-nameplate` |
| `FCM_SERVER_KEY` | Rendre les notifications push réellement fonctionnelles |
| Secret de webhook e-mail | Sécuriser `handle-email-suppression` si le fournisseur d'e-mails appelle un webhook (**À VÉRIFIER** : la fonction est en `verify_jwt = false`) |

## 4. URLs codées en dur — inventaire complet

### 4.1 URLs Lovable (🔴 à supprimer ou remplacer)

| Emplacement | URL | Nature | Action |
|---|---|---|---|
| `capacitor.config.ts:8` | `https://c2f1872a-…lovableproject.com?forceHideBadge=true` | URL frontend de l'app native | **Obligatoire** : remplacer par le domaine final, ou supprimer le bloc `server.url` pour empaqueter les fichiers locaux (`webDir: dist`) |
| `capacitor.config.ts:4` | `appId: app.lovable.c2f1872a…` | Identifiant d'application mobile | À renommer (`be.agchauffage.terrain` p. ex.) **avant** toute publication sur les stores — non modifiable après publication |
| `supabase/functions/analyze-nameplate/index.ts:39` | `https://ai.gateway.lovable.dev/v1/chat/completions` | API IA | À remplacer par l'endpoint du fournisseur IA choisi |
| `supabase/functions/process-email-queue/index.ts` | repli `https://api.lovable.dev` | Envoi d'e-mails | À remplacer par le fournisseur d'e-mails |
| `vite.config.ts` | plugin `lovable-tagger` | Outillage de développement | Sans effet en production (`mode === "development"`), mais la dépendance npm reste — voir doc 13 |

### 4.2 URLs Supabase (🟠 à mettre à jour si le projet change de référence)

| Emplacement | URL | Action |
|---|---|---|
| `.env` | `https://obvvrvcvijyvnnfdcrpg.supabase.co` | Nouvelle URL projet |
| Fonctions SQL `email_queue_dispatch()` et `email_queue_wake()` | `https://obvvrvcvijyvnnfdcrpg.supabase.co/functions/v1/process-email-queue` | **Codée en dur dans le corps des fonctions** — à réécrire par migration SQL |
| Job cron `security-monitor-hourly` | `https://obvvrvcvijyvnnfdcrpg.supabase.co/functions/v1/security-monitor` | À recréer avec la nouvelle URL |
| Job cron `send-entretien-reminders-daily` | `https://obvvrvcvijyvnnfdcrpg.supabase.co/functions/v1/send-entretien-reminders` | À recréer |
| Migration `20260504172853_….sql` | même URL | Historique — ne pas rejouer tel quel |
| `src/components/admin/CreateUserDialog.tsx`, `EditUserDialog.tsx`, `AdminUsersTab.tsx`, `SuperAdminUsers.tsx`, `Unsubscribe.tsx` | `${VITE_SUPABASE_URL}/functions/v1/<fonction>` | ✅ Construites depuis la variable d'environnement — **aucune action** |

### 4.3 URLs d'API / services externes

| URL | Service | Emplacement | Impact migration |
|---|---|---|---|
| `https://fcm.googleapis.com/fcm/send` | Firebase Cloud Messaging (**API legacy**) | `send-push/index.ts:127` | ⚠️ L'API HTTP legacy de FCM est dépréciée par Google. Migrer vers l'API HTTP v1 |
| `https://esm.sh/@supabase/supabase-js@2.49.1` / `@2.45.0` / `@2.97.0` | CDN de dépendances Deno | plusieurs fonctions | Fonctionne partout ; à **uniformiser** sur une seule version |
| `https://deno.land/std@0.224.0/...` | Bibliothèque standard Deno | fichiers de test | Sans impact |
| `https://fonts.googleapis.com` / `fonts.gstatic.com` | Google Fonts | `src/index.css`, cache PWA | Sans impact |
| `https://www.google.com/maps/search/?api=1&query=…` | Ouverture d'itinéraire | `MobileAgenda.tsx:295`, `MobileTaskDetail.tsx:275` | Sans impact |

### 4.4 URLs frontend / callback / redirection

- **Aucune URL frontend codée en dur** dans `src/` : le code utilise `window.location.origin`. C'est une **très bonne nouvelle** pour le changement de domaine.
- `emailRedirectTo: window.location.origin` dans `signUp()` (code mort).
- Aucune URL OAuth (aucun provider social configuré).
- Aucun webhook sortant applicatif ; le seul point d'entrée externe potentiel est `handle-email-suppression` (webhook du fournisseur d'e-mails) — **À VÉRIFIER** : est-il réellement enregistré chez le fournisseur ?
- Lien de désabonnement : construit dans les templates d'e-mail — **À VÉRIFIER** dans `supabase/functions/_shared/transactional-email-templates/` si le domaine y est codé en dur (voir doc 07).

### 4.5 URLs d'images / fichiers

- `company-assets` : bucket **public** → URL de la forme `https://<ref>.supabase.co/storage/v1/object/public/company-assets/<company_id>/<fichier>`. Ces URLs sont **stockées en base** (`companies.logo_url`, `pdf_settings.logo_url`).
  🔴 **Point d'attention majeur** : si la référence du projet Supabase change, **toutes ces URLs stockées deviennent invalides** → prévoir un `UPDATE` SQL de réécriture après migration.
- `intervention-photos`, `intervention-signatures`, `quote-assets` : privés, lus via URL signée générée à la volée (`useSignedUrl`). Les colonnes stockent des **chemins** et non des URLs complètes dans la plupart des cas — **À VÉRIFIER** au cas par cas dans `intervention_sheets.photos_*` (certaines valeurs peuvent être des URLs complètes selon l'historique de synchronisation hors-ligne).

## 5. Récapitulatif : ce qui casse au changement de domaine

| Élément | Impacté par le changement de **domaine frontend** | Impacté par le changement de **projet Supabase** |
|---|---|---|
| Code frontend (`window.location.origin`) | Non — s'adapte tout seul | Non |
| `capacitor.config.ts` | **Oui** | Non |
| Supabase Auth : Site URL + Redirect URLs | **Oui** | Oui |
| CORS des edge functions | Non (`corsHeaders` autorise `*`) — **À VÉRIFIER** et resserrer | Non |
| Cookies | Non concerné (session en localStorage) | Non |
| Liens dans les e-mails | **Oui** | Oui |
| URLs publiques du bucket `company-assets` stockées en base | Non | **Oui** |
| Fonctions SQL et jobs cron appelant `/functions/v1/...` | Non | **Oui** |
| Webhook du fournisseur d'e-mails | Non | **Oui** |
