# 06 — Backend : fonctions Edge et automatisations

Audit exhaustif de `supabase/functions/` (12 fonctions + `_shared/`), de `supabase/config.toml` et des automatisations base de données (pg_cron, pg_net, pgmq, vault) déduites des migrations SQL.

Projet Supabase actuel : `project_id = obvvrvcvijyvnnfdcrpg` (`supabase/config.toml`).

---

## Conventions communes observées

- Toutes les fonctions sont des handlers `Deno.serve` classiques (pas de framework), avec gestion CORS manuelle (`OPTIONS` → 200) sauf `handle-email-suppression` (webhook serveur-à-serveur, pas de CORS).
- Deux styles d'import cohabitent : `npm:@supabase/supabase-js@2` (style Deno/npm) et `https://esm.sh/@supabase/supabase-js@2.x.x` (style esm.sh), avec des versions figées différentes selon les fichiers (2.45.0, 2.49.1, 2.97.0, ou `@2` non épinglé). **À VÉRIFIER** : absence de lockfile Deno commun, donc versions potentiellement incohérentes entre fonctions.
- Le contrôle de rôle/`company_id` est fait **dans le code**, pas uniquement via RLS : chaque fonction qui agit avec la clé `service_role` doit revalider elle-même les droits de l'appelant.
- Secrets lus via `Deno.env.get(...)` (secrets Supabase Edge Functions), jamais de valeur en dur sauf `SENDER_DOMAIN`/`FROM_DOMAIN`/`SITE_NAME` dans `send-transactional-email` (configuration métier, pas un secret).

---

## Inventaire détaillé des fonctions

### 1. `analyze-nameplate`

- **Rôle** : analyse une photo de plaque signalétique d'appareil de chauffage via un LLM vision et retourne les caractéristiques extraites en JSON.
- **Déclencheur** : appel front `supabase.functions.invoke("analyze-nameplate")` — `src/components/mobile/steps/NameplateStep.tsx`.
- **Paramètres reçus** : `{ imageDataUrl: string }` (data URL base64). Validation : présence et type `string` uniquement.
- **Données utilisées** : aucune donnée DB ; l'image est envoyée telle quelle à l'API externe.
- **Données retournées** : `{ data: { brand, model, serialNumber, nominalPower, usefulPower, fuelType, servicePressure, caloricFlow, yearOfManufacture, ceNumber, category, otherInfo } }` (JSON extrait du contenu LLM, avec repli sur extraction regex si le parsing JSON strict échoue).
- **Tables lues/écrites** : aucune.
- **API externe** : `https://ai.gateway.lovable.dev/v1/chat/completions` (Lovable AI Gateway, modèle `google/gemini-3.5-flash`).
- **Secrets requis** : `LOVABLE_API_KEY`.
- **Dépendances** : `npm:@supabase/supabase-js@2` (uniquement pour `cors` helper — pas de client DB créé).
- **JWT / rôle** : `verify_jwt = true` (config.toml) — aucune vérification de rôle/`company_id` supplémentaire dans le code (tout utilisateur authentifié peut appeler).
- **Emplacement actuel** : `supabase/functions/analyze-nameplate/index.ts`.
- **Cible migration** : Edge Function Supabase autonome à conserver telle quelle (pas de dépendance DB), ou route Vercel serverless proxy si le projet bascule vers un backend hors Supabase — nécessite alors de conserver `LOVABLE_API_KEY` côté serveur.

---

### 2. `cleanup-orphan-auth`

- **Rôle** : outil d'administration listant/supprimant les comptes `auth.users` sans ligne `profiles` correspondante (orphelins issus d'échecs de provisioning).
- **Déclencheur** : invocation manuelle (outil d'administration/backoffice) — **aucun appel front trouvé dans `src/`**. **À VÉRIFIER** : probablement appelé en ad-hoc via curl/CLI par un super admin, pas intégré à l'UI.
- **Paramètres reçus** : `{ action?: "list"|"delete_by_email"|"delete_by_id", email?, user_id? }`. Validation minimale (défaut `action="list"`).
- **Données utilisées** : liste paginée de `auth.admin.listUsers` + table `profiles`.
- **Données retournées** : `{ orphans: [...] }` ou `{ success: true, deleted }` ou erreurs 401/403/404.
- **Tables lues/écrites** : lecture `profiles` ; écriture indirecte via `auth.admin.deleteUser`.
- **API externe** : aucune (Supabase Admin API interne).
- **Secrets requis** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
- **Dépendances** : `https://esm.sh/@supabase/supabase-js@2.49.1`.
- **JWT / rôle** : **absent de `config.toml`** → `verify_jwt` par défaut (`true` selon la doc Supabase). Contrôle applicatif : soit le bearer token = clé service_role, soit l'appelant doit avoir `profiles.role = 'super_admin'`.
- **Emplacement actuel** : `supabase/functions/cleanup-orphan-auth/index.ts`.
- **Cible migration** : Edge Function autonome (nécessite la clé service_role) ; équivalent possible en route Vercel avec le SDK admin Supabase si le hosting front bascule vers Vercel, sans changement fonctionnel.

---

### 3. `create-user`

- **Rôle** : création d'un utilisateur applicatif (auth + profil + rôle) avec hiérarchie de rôles et cantonnement multi-tenant (`company_id`), y compris réparation d'un compte auth existant sans profil.
- **Déclencheur** : front `supabase.functions.invoke("create-user")` — `src/pages/super-admin/SuperAdminUsers.tsx`.
- **Paramètres reçus** : `{ email, password, full_name, role, company_id?, worker_level? }`. Validation : champs requis, normalisation email, refus de créer un `super_admin`, refus si rôle hors hiérarchie autorisée pour l'appelant.
- **Données utilisées** : `profiles` (rôle/`company_id` de l'appelant et de la cible), `companies` (`is_active`, `max_users`).
- **Données retournées** : `{ user: { id, email } }` ou `{ user, repaired_existing_user: true }`, erreurs 400/401/403/404/500.
- **Tables lues/écrites** : lecture `profiles`, `companies` ; écriture `profiles` (insert/update), `user_roles` (delete puis upsert via `syncSingleRole`) ; `auth.users` (création/mise à jour via Admin API), rollback (`deleteUser`) si l'update du profil échoue.
- **API externe** : aucune.
- **Secrets requis** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
- **Dépendances** : `https://esm.sh/@supabase/supabase-js@2.49.1`. Tests dédiés présents : `isolation_test.ts`, `security_test.ts`.
- **JWT / rôle** : **absent de `config.toml`** (donc `verify_jwt` par défaut). Contrôle applicatif fin : bearer = service_role OU header `x-internal-key` = service_role (bypass) OU appelant avec `profiles.role` ∈ {`super_admin`,`admin`,`bureau`} ; hiérarchie de création (`super_admin`→admin/bureau/ouvrier, `admin`→bureau/ouvrier, `bureau`→ouvrier) ; `company_id` strictement cantonné à celui de l'appelant sauf `super_admin` ; vérification `companies.is_active` et `max_users`.
- **Emplacement actuel** : `supabase/functions/create-user/index.ts` (+ tests `isolation_test.ts`, `security_test.ts`).
- **Cible migration** : Edge Function autonome à isoler avec grand soin (logique de sécurité multi-tenant critique) ; si migration vers route Vercel, porter également les deux fichiers de tests et re-vérifier l'équivalent du header `x-internal-key`.

---

### 4. `handle-email-suppression`

- **Rôle** : réception de webhooks de suppression email (bounce/complaint/unsubscribe) et mise à jour de la liste de suppression + journal d'envoi.
- **Déclencheur** : **webhook externe** signé HMAC — décrit comme envoyé par « le Go API » lorsqu'un bounce/complaint/unsubscribe Mailgun est détecté. Pas d'appel front.
- **Paramètres reçus** : payload JSON `{ data: { email, reason, message_id?, metadata?, is_retry, retry_count } }`. Validation : présence de `data`, `email`, `reason` ; sinon `WebhookError`.
- **Données utilisées** : signature HMAC vérifiée avec `LOVABLE_API_KEY` comme secret partagé.
- **Données retournées** : `{ success: true }` ou erreurs 400/401/405/500.
- **Tables lues/écrites** : upsert `suppressed_emails` (idempotent), insert `email_send_log` (non bloquant si échec).
- **API externe** : aucune (fonction elle-même est le webhook receiver).
- **Secrets requis** : `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Dépendances** : `npm:@supabase/supabase-js@2`, `npm:@lovable.dev/webhooks-js` (vérification HMAC/anti-rejeu, spécifique Lovable — **dépendance propriétaire non portable telle quelle**).
- **JWT / rôle** : `verify_jwt = false` (config.toml, obligatoire car webhook externe non-Supabase) ; sécurité assurée uniquement par la vérification de signature HMAC (`verifyWebhookRequest`).
- **Emplacement actuel** : `supabase/functions/handle-email-suppression/index.ts`.
- **Cible migration** : **point de vigilance majeur** — dépend de `npm:@lovable.dev/webhooks-js`, package propriétaire Lovable. Hors plateforme Lovable, il faut réécrire la vérification HMAC en code générique (HMAC-SHA256 + fenêtre de tolérance temporelle) avant de migrer vers une Edge Function autonome ou une route Vercel.

---

### 5. `handle-email-unsubscribe`

- **Rôle** : page/API de désinscription email — validation puis consommation d'un token de désinscription, y compris support du désabonnement « one-click » RFC 8058.
- **Déclencheur** : appel front `supabase.functions.invoke("handle-email-unsubscribe")` — `src/pages/Unsubscribe.tsx` (GET pour valider, POST pour confirmer) ; également appelable directement par les clients mail (POST `application/x-www-form-urlencoded` avec `List-Unsubscribe=One-Click`).
- **Paramètres reçus** : `token` en query string (GET/POST one-click) ou dans le corps JSON `{ token }` (POST depuis l'app).
- **Données utilisées** : `email_unsubscribe_tokens`.
- **Données retournées** : `{ valid: true|false }` (GET), `{ success: true }` / `{ success: false, reason: 'already_unsubscribed' }` (POST), erreurs 400/404/405/500.
- **Tables lues/écrites** : lecture + update conditionnelle (`used_at IS NULL`, anti-TOCTOU) sur `email_unsubscribe_tokens` ; upsert `suppressed_emails`.
- **API externe** : aucune.
- **Secrets requis** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Dépendances** : `npm:@supabase/supabase-js@2`.
- **JWT / rôle** : `verify_jwt = false` (nécessaire : appelé par des clients mail tiers sans JWT). Sécurité par token opaque à usage unique, pas de contrôle de rôle.
- **Emplacement actuel** : `supabase/functions/handle-email-unsubscribe/index.ts`.
- **Cible migration** : Edge Function autonome ou route Vercel publique équivalente ; conserver `verify_jwt=false` / accès public par design.

---

### 6. `preview-transactional-email`

- **Rôle** : rendu HTML de tous les templates d'email transactionnels enregistrés (`registry.ts`) avec leurs données d'exemple, pour prévisualisation en backoffice.
- **Déclencheur** : décrit dans le code comme « Gated by LOVABLE_API_KEY — only the Go API calls this » → appel serveur-à-serveur externe, pas d'appel front trouvé dans `src/`.
- **Paramètres reçus** : aucun corps requis ; auth via header `Authorization: Bearer <LOVABLE_API_KEY>`.
- **Données utilisées** : `TEMPLATES` (registre statique, pas de DB).
- **Données retournées** : `{ templates: [{ templateName, displayName, subject, html, status, errorMessage? }] }`.
- **Tables lues/écrites** : aucune.
- **API externe** : aucune (le rendu est local via `@react-email/components`).
- **Secrets requis** : `LOVABLE_API_KEY`.
- **Dépendances** : `npm:react@18.3.1`, `npm:@react-email/components@0.0.22`, `npm:@supabase/supabase-js@2` (cors uniquement).
- **JWT / rôle** : `verify_jwt = false` (config.toml) — protection uniquement via comparaison du bearer token à `LOVABLE_API_KEY` (pas un vrai JWT Supabase).
- **Emplacement actuel** : `supabase/functions/preview-transactional-email/index.ts`, dépend de `supabase/functions/_shared/transactional-email-templates/{registry.ts, fiche-intervention.tsx, rappel-entretien.tsx}`.
- **Cible migration** : Edge Function autonome, ou route Vercel si le rendu React Email est déplacé côté Node ; portera aussi le dossier `_shared/transactional-email-templates`.

---

### 7. `process-email-queue`

- **Rôle** : dispatcher/worker de la file d'emails (pgmq) — lit par lots les files `auth_emails` puis `transactional_emails`, envoie via l'API email Lovable, gère TTL, retries, rate-limit 429, DLQ.
- **Déclencheur** : **cron** (voir section Automatisations) — invoqué toutes les ~5 secondes via `net.http_post` déclenché par pg_cron/trigger, avec le token `service_role` en Authorization. Aucun appel front.
- **Paramètres reçus** : aucun corps ; toute la configuration vient de `email_send_state`.
- **Validation** : vérifie que le JWT porte `role: service_role` (défense en profondeur en plus de `verify_jwt=true`).
- **Données utilisées** : `email_send_state` (config batch/délai/TTL/cooldown), messages des queues pgmq `auth_emails`/`transactional_emails`.
- **Données retournées** : `{ processed, skipped?, stopped? }` JSON.
- **Tables lues/écrites** : lecture `email_send_state` ; lecture/écriture `email_send_log` (insert statuts sent/failed/rate_limited/dlq) ; update `email_send_state.retry_after_until` sur 429 ; RPC `read_email_batch`, `delete_email`, `move_to_dlq` (wrappers pgmq, SECURITY DEFINER, `public` schema).
- **API externe** : API d'envoi email Lovable via `sendLovableEmail` (`npm:@lovable.dev/email-js`), URL par défaut `https://api.lovable.dev`, surchargable par `LOVABLE_SEND_URL`.
- **Secrets requis** : `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optionnel `LOVABLE_SEND_URL`.
- **Dépendances** : `npm:@lovable.dev/email-js` (propriétaire Lovable), `npm:@supabase/supabase-js@2`.
- **JWT / rôle** : `verify_jwt = true` (config.toml) + contrôle explicite `claims.role === 'service_role'` dans le code (rejette tout appel authentifié non-service_role).
- **Emplacement actuel** : `supabase/functions/process-email-queue/index.ts`.
- **Cible migration** : **point de vigilance majeur** — dépend de `npm:@lovable.dev/email-js` (client propriétaire) et de RPC pgmq spécifiques Postgres/Supabase. Hors Lovable, il faut (a) remplacer le client d'envoi par l'API Mailgun/SES/Resend directe, (b) conserver pgmq+pg_cron si la base reste Supabase/Postgres, ou (c) réécrire la file avec une queue managée (SQS, Upstash) si le worker est déplacé vers une route Vercel/cron Vercel — Vercel Cron a un pas minimal de 1 minute, incompatible avec le cycle actuel de 5 secondes.

---

### 8. `security-monitor`

- **Rôle** : scan de sécurité périodique — détecte les fonctions `SECURITY DEFINER` exposées de façon anormale (RPC `list_security_definer_violations`) et journalise le résultat.
- **Déclencheur** : **cron pg_cron** `security-monitor-hourly` (voir section Automatisations), toutes les heures par défaut, planifiable dynamiquement via `platform_settings`.
- **Paramètres reçus** : aucun corps requis.
- **Données utilisées** : résultat de la RPC `list_security_definer_violations`.
- **Données retournées** : `{ ok, count, violations, scanned_at }`, code 200 si `count=0`, sinon 409.
- **Tables lues/écrites** : RPC `list_security_definer_violations` (lecture catalogue Postgres) ; insert `activity_logs` (`security_alert_definer_exposed` ou `security_scan_clean`).
- **API externe** : aucune.
- **Secrets requis** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Dépendances** : `https://esm.sh/@supabase/supabase-js@2.45.0`.
- **JWT / rôle** : **absent de `config.toml`** → `verify_jwt` par défaut. Contrôle applicatif : bearer = service_role OU header `x-internal-key` = service_role — aucune vérification de rôle `profiles` (par design, appel uniquement interne/cron).
- **Emplacement actuel** : `supabase/functions/security-monitor/index.ts`.
- **Cible migration** : Edge Function autonome ; si le monitoring se déplace hors Supabase, remplacer par un job Vercel Cron + connexion Postgres directe pour exécuter la RPC.

---

### 9. `send-entretien-reminders`

- **Rôle** : job d'envoi automatique des rappels d'entretien aux clients dont une échéance de maintenance approche, selon les paramètres `email_settings` par entreprise.
- **Déclencheur** : **cron / job planifié** (non retrouvé sous forme de `cron.schedule` statique dans les migrations — probablement configuré dynamiquement, comme `process-email-queue`). **À VÉRIFIER** directement en base (`SELECT * FROM cron.job`) car absent des fichiers SQL versionnés.
- **Paramètres reçus** : aucun corps requis.
- **Données utilisées** : `email_settings` (template `rappel-entretien`, par `company_id` ou global), `maintenance_schedules` jointes à `clients` et `client_equipment`.
- **Données retournées** : `{ sent, skipped }`.
- **Tables lues/écrites** : lecture `email_settings`, `maintenance_schedules`, `clients`, `client_equipment` ; update `maintenance_schedules.reminder_sent_at`.
- **API externe** : appel HTTP interne à une **autre Edge Function** : `${SUPABASE_URL}/functions/v1/send-transactional-email` (donc dépendance directe fonction-à-fonction, avec URL construite dynamiquement à partir de `SUPABASE_URL` — pas codée en dur ici).
- **Secrets requis** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Dépendances** : `npm:@supabase/supabase-js@2`.
- **JWT / rôle** : `verify_jwt = true` (config.toml). Aucune vérification de rôle applicative dans le code (délègue entièrement à la gateway JWT — cohérent avec un déclenchement cron interne portant le token service_role).
- **Emplacement actuel** : `supabase/functions/send-entretien-reminders/index.ts`.
- **Cible migration** : Edge Function autonome, ou job Vercel Cron appelant l'équivalent de `send-transactional-email` en HTTP ; nécessite de retrouver/documenter précisément la planification cron actuelle avant migration (voir section suivante).

---

### 10. `send-push`

- **Rôle** : envoi de notifications push (Firebase Cloud Messaging, API legacy) à une liste d'utilisateurs, avec nettoyage des tokens invalides.
- **Déclencheur** : appel manuel/back-office (aucun appel `functions.invoke("send-push")` trouvé dans `src/`). **À VÉRIFIER** : probablement invoqué depuis une action admin non encore branchée au front, ou en cours de dépréciation.
- **Paramètres reçus** : `{ user_ids: string[], title: string, body: string, data?: Record<string,string> }`. Validation : `user_ids` et `title` requis.
- **Données utilisées** : `profiles` (rôle/`company_id` de l'appelant), `push_tokens` (tokens des destinataires).
- **Données retournées** : `{ sent, total }` ou `{ sent: 0, message }`.
- **Tables lues/écrites** : lecture `profiles`, `push_tokens` (scoping par `company_id` si appelant non `super_admin`) ; delete `push_tokens` pour les tokens FCM invalides (`InvalidRegistration`/`NotRegistered`).
- **API externe** : `https://fcm.googleapis.com/fcm/send` (API FCM legacy, **dépréciée par Google** — migration vers FCM HTTP v1 à prévoir indépendamment de la migration de plateforme).
- **Secrets requis** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `FCM_SERVER_KEY`.
- **Dépendances** : `https://esm.sh/@supabase/supabase-js@2.97.0`.
- **JWT / rôle** : **absent de `config.toml`** → `verify_jwt` par défaut. Contrôle applicatif : JWT obligatoire (`getUser()`), rôle appelant ∈ {`admin`,`bureau`,`super_admin`}, cantonnement des destinataires à `company_id` de l'appelant sauf `super_admin`.
- **Emplacement actuel** : `supabase/functions/send-push/index.ts`.
- **Cible migration** : Edge Function autonome ; profiter de la migration pour basculer vers FCM HTTP v1 (OAuth2 service account) plutôt que l'API legacy dépréciée, indépendamment du choix Supabase Edge Function / route Vercel.

---

### 11. `send-transactional-email`

- **Rôle** : point d'entrée principal pour envoyer un email transactionnel — résout le template, vérifie la liste de suppression, gère/génère le token de désabonnement, rend le HTML/texte via React Email, puis **empile** le message dans la file pgmq `transactional_emails` (envoi réel délégué à `process-email-queue`).
- **Déclencheur** : appel front `supabase.functions.invoke("send-transactional-email")` — `src/lib/sendEmailAG.ts` (deux appels : fiche d'intervention et rappel entretien) ; également appelé en interne par `send-entretien-reminders` via HTTP direct.
- **Paramètres reçus** : `{ templateName|template_name, recipientEmail|recipient_email, idempotencyKey|idempotency_key?, templateData? }`. Validation : `templateName` requis, `template` doit exister dans `TEMPLATES`, destinataire requis sauf si le template définit un `to` fixe.
- **Données utilisées** : registre `TEMPLATES` (`_shared/transactional-email-templates/registry.ts`) ; config d'expéditeur codée en dur dans le fichier : `SITE_NAME = "ground-crew-grid"`, `SENDER_DOMAIN = "notify.agchauffage.be"`, `FROM_DOMAIN = "agchauffage.be"` — **valeurs spécifiques au projet actuel, à régénérer/adapter si migration vers un autre domaine ou une autre configuration d'envoi email**.
- **Données retournées** : `{ success: true, queued: true }`, `{ success: false, reason: 'email_suppressed' }`, ou erreurs 400/404/500.
- **Tables lues/écrites** : lecture `suppressed_emails` (fail-closed si erreur), lecture/upsert `email_unsubscribe_tokens` (un token par email, gestion de concurrence), insert `email_send_log` (statuts `pending`/`suppressed`/`failed`) ; RPC `enqueue_email` (écrit dans pgmq `transactional_emails`).
- **API externe** : aucune (l'envoi réel se fait dans `process-email-queue`).
- **Secrets requis** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Dépendances** : `npm:react@18.3.1`, `npm:@react-email/components@0.0.22`, `npm:@supabase/supabase-js@2`.
- **JWT / rôle** : `verify_jwt = true` (config.toml), documenté explicitement dans le code comme suffisant (aucun contrôle de rôle/`company_id` supplémentaire — tout utilisateur authentifié, y compris `service_role`, peut déclencher un envoi vers n'importe quel destinataire).
- **Emplacement actuel** : `supabase/functions/send-transactional-email/index.ts`, dépend de `_shared/transactional-email-templates/`.
- **Cible migration** : Edge Function autonome ; **contient la seule configuration d'expéditeur en dur du dépôt** (nom de site + domaines d'envoi) → à externaliser en variables d'environnement/secrets si le domaine d'envoi change lors de la migration.

---

### 12. `update-user`

- **Rôle** : mise à jour (email/mot de passe/nom) ou suppression d'un utilisateur applicatif, avec contrôle hiérarchique de rôle et journalisation.
- **Déclencheur** : appel front direct par `fetch` HTTP (pas `functions.invoke`) vers `${VITE_SUPABASE_URL}/functions/v1/update-user` — `src/components/admin/AdminUsersTab.tsx`, `src/components/admin/EditUserDialog.tsx`, `src/pages/super-admin/SuperAdminUsers.tsx`.
- **Paramètres reçus** : `{ user_id, action?: 'delete'|undefined, email?, password?, full_name? }`. Validation : `user_id` requis ; interdiction de se supprimer soi-même.
- **Données utilisées** : `profiles` (rôle/`company_id` de l'appelant et de la cible).
- **Données retournées** : `{ success: true }` ou erreurs 400/401/403/404/500.
- **Tables lues/écrites** : lecture `profiles` (cible) ; suppression : `auth.users` (cascade), `user_roles`, `push_tokens`, `profiles` (delete), insert `activity_logs` (`delete_user`) ; mise à jour : `auth.users` (email/password via Admin API), `profiles` (update), insert `activity_logs` (`update_user_credentials`).
- **API externe** : aucune.
- **Secrets requis** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
- **Dépendances** : `https://esm.sh/@supabase/supabase-js@2.49.1`.
- **JWT / rôle** : **absent de `config.toml`** → `verify_jwt` par défaut. Contrôle applicatif : bearer = service_role OU appelant avec `profiles.role` ∈ {`super_admin`,`admin`} ; un `admin` ne peut agir que sur des utilisateurs de sa propre `company_id` et ne peut pas modifier un `admin`/`super_admin`.
- **Emplacement actuel** : `supabase/functions/update-user/index.ts`.
- **Cible migration** : Edge Function autonome ou route Vercel API ; **remplacer l'appel `fetch` direct avec URL construite depuis `VITE_SUPABASE_URL`** par un appel relatif si la route est déplacée vers Vercel (`/api/update-user`), pour éviter de coder l'URL Supabase en dur côté front.

---

## Automatisations base de données

### Extensions activées (`supabase/migrations/20260715204629_email_infra.sql`)

| Extension | Schéma | Usage |
|---|---|---|
| `pg_net` | `extensions` | Appels HTTP asynchrones depuis Postgres (`net.http_post`) pour déclencher les Edge Functions depuis pg_cron. |
| `pg_cron` | — | Planification de jobs SQL périodiques. |
| `supabase_vault` | — | Stockage chiffré de secrets utilisés dans les jobs SQL (ex. clé service_role). |
| `pgmq` | `pgmq` | Files de messages (`auth_emails`, `transactional_emails`, + DLQ associées) consommées par `process-email-queue`. |

### Jobs pg_cron

1. **`security-monitor-hourly`** — confirmé en migration (`20260504172853_...sql`) :
   ```sql
   SELECT cron.schedule('security-monitor-hourly', '0 * * * *', $$
     SELECT net.http_post(
       url := 'https://obvvrvcvijyvnnfdcrpg.supabase.co/functions/v1/security-monitor',
       headers := '{"Content-Type":"application/json","apikey":"<JWT anon codé en dur>"}'::jsonb,
       body := '{}'::jsonb
     );
   $$);
   ```
   Planification reprogrammable dynamiquement via la fonction `private.apply_security_monitor_schedule()` et le trigger `trg_apply_security_monitor_schedule` sur `public.platform_settings` (clé `security_monitor_cron_schedule`), migration `20260504173228_...sql`.
   ⚠️ **URL de fonction et JWT `apikey` codés en dur dans le SQL** — à régénérer impérativement en cas de changement de projet Supabase (nouvelle `project_id`, nouvelle clé anon).

2. **`process-email-queue`** (nom de job présumé identique ou proche) — **non présent sous forme de `cron.schedule` statique dans les migrations versionnées**. Le fichier `20260715204629_email_infra.sql` documente explicitement en commentaire que cette étape est appliquée **dynamiquement via l'API de gestion Supabase (Management API `ExecuteSQL`)** à chaque exécution de l'outillage, car elle contient des secrets/URLs spécifiques au projet — donc **absente du dépôt Git par conception**. Le commentaire précise : job attendu avec un intervalle de 5 secondes, condition sur `email_send_state.retry_after_until` et sur le contenu des files `auth_emails`/`transactional_emails`, appel `net.http_post` vers `process-email-queue` avec la clé service_role lue depuis **vault** (secret nommé `email_queue_service_role_key`). Les fonctions `public.email_queue_wake()` et `public.email_queue_dispatch()` (référencées et sécurisées — `REVOKE`/`GRANT` — dans `20260715210841_...sql`) semblent être le mécanisme réel de réveil/dispatch de ce job, mais **leur définition SQL n'apparaît dans aucune migration versionnée**. **À VÉRIFIER en base live** : `SELECT * FROM cron.job;` et `\df public.email_queue_*` pour confirmer schedule exact et corps de fonction.

3. **Rappels d'entretien (`send-entretien-reminders`)** — **aucune trace de planification cron dans les migrations SQL versionnées**. Le nom de la fonction n'apparaît dans aucun fichier `supabase/migrations/*.sql`. **À VÉRIFIER en base live** (`cron.job`) : soit ce job est configuré dynamiquement comme `process-email-queue` (hors dépôt Git), soit il n'est actuellement pas planifié et déclenché uniquement manuellement/à revérifier côté produit.

### Secrets stockés en Vault (noms uniquement)

- `email_queue_service_role_key` — clé service_role utilisée par le(s) job(s) cron pour authentifier les appels `net.http_post` vers les Edge Functions email. **À VÉRIFIER** si d'autres secrets vault existent (aucune autre référence trouvée dans les migrations versionnées) : `SELECT name FROM vault.secrets;` en base live.

### Triggers Postgres identifiés

| Trigger | Table | Fonction | Rôle |
|---|---|---|---|
| `trg_apply_security_monitor_schedule` | `public.platform_settings` | `private.tg_apply_security_monitor_schedule()` → `private.apply_security_monitor_schedule()` | Reprogramme automatiquement le job `security-monitor-hourly` (`cron.alter_job`) quand la clé `security_monitor_cron_schedule` est insérée/modifiée dans `platform_settings`. |
| `handle_new_user` (référencé dans `create-user`, non lu ici en détail) | `auth.users` (présumé) | non fournie dans le périmètre lu | Matérialise la ligne `profiles` à la création d'un compte auth — **À VÉRIFIER** : définition exacte hors des fichiers listés dans la consigne (à documenter dans l'audit des migrations si nécessaire). |

### URLs de fonctions codées en dur dans le SQL

| Fichier | URL en dur | Impact migration |
|---|---|---|
| `supabase/migrations/20260504172853_2dcf018b-2905-4305-9160-5b86035c40d7.sql` | `https://obvvrvcvijyvnnfdcrpg.supabase.co/functions/v1/security-monitor` + JWT `apikey` anon en clair dans le header | Si le projet Supabase change de `project_id`/URL, **ce job cassera silencieusement** (le `net.http_post` échouera) tant que l'URL et l'`apikey` anon ne sont pas régénérées manuellement via une nouvelle migration ou `cron.alter_job`. |
| Job(s) dynamique(s) `process-email-queue` et éventuellement rappels entretien | non versionné, mais décrit comme pointant vers `.../functions/v1/process-email-queue` avec la clé service_role vault | Même risque, à revalider directement en base (`cron.job.command`) après toute migration de projet Supabase. |

⚠️ **Recommandation migration** : avant tout changement de `project_id`/domaine Supabase, extraire `SELECT jobid, jobname, schedule, command FROM cron.job;` en base live pour capturer l'état réel (les deux jobs dynamiques ne sont pas dans Git) et régénérer systématiquement les URLs + clés `apikey`/`service_role` dans chaque `command`.

---

## Tableau récapitulatif

| Fonction | Déclencheur | Secrets | Services externes | Criticité migration |
|---|---|---|---|---|
| `analyze-nameplate` | Front (`functions.invoke`) | `LOVABLE_API_KEY` | Lovable AI Gateway (`ai.gateway.lovable.dev`) | Faible — aucune dépendance DB, portable tel quel. |
| `cleanup-orphan-auth` | Manuel/admin (pas d'appel front trouvé) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Aucun | Faible — outil interne, logique simple. |
| `create-user` | Front (`functions.invoke`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Aucun | **Élevée** — logique multi-tenant/hiérarchie de rôles critique, tests dédiés à repasser. |
| `handle-email-suppression` | Webhook externe (Go API / Mailgun) | `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Webhook entrant (signature HMAC via `@lovable.dev/webhooks-js`) | **Élevée** — dépend d'un package propriétaire Lovable à réécrire hors plateforme. |
| `handle-email-unsubscribe` | Front + clients mail (one-click RFC 8058) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Aucun | Faible — logique autonome, `verify_jwt=false` à conserver. |
| `preview-transactional-email` | Serveur-à-serveur externe (Go API) | `LOVABLE_API_KEY` | Aucun | Moyenne — dépend du registre de templates partagé. |
| `process-email-queue` | pg_cron (~5s, dynamique, non versionné) | `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_SEND_URL` (opt.) | API d'envoi email Lovable (`api.lovable.dev` ou override) | **Élevée** — dépend de `@lovable.dev/email-js` + pgmq + cron dynamique non documenté en Git. |
| `security-monitor` | pg_cron horaire (`security-monitor-hourly`, versionné) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Aucun | Moyenne — URL/JWT codés en dur dans la migration à régénérer si changement de projet. |
| `send-entretien-reminders` | Cron présumé (non retrouvé en Git — à vérifier en base) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Appel interne à `send-transactional-email` | Moyenne — planification cron à confirmer avant migration. |
| `send-push` | Manuel/admin (pas d'appel front trouvé) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `FCM_SERVER_KEY` | FCM legacy (`fcm.googleapis.com`, API dépréciée) | Moyenne — à moderniser vers FCM HTTP v1 indépendamment de la migration. |
| `send-transactional-email` | Front (`functions.invoke`) + appel interne par `send-entretien-reminders` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Aucun (délègue l'envoi à `process-email-queue`) | **Élevée** — contient la config d'expéditeur (domaines) codée en dur, à externaliser. |
| `update-user` | Front (`fetch` direct sur URL Supabase codée via `VITE_SUPABASE_URL`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Aucun | **Élevée** — logique de droits hiérarchiques + URL front codée en dur à généraliser. |
