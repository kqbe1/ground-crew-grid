# 07 — Stockage de fichiers, emails et notifications

> Document d'audit technique. Toute affirmation non vérifiée directement dans le code ou les migrations est marquée **À VÉRIFIER**.

---

## Partie A — Stockage de fichiers (Supabase Storage)

### Vue d'ensemble des buckets

| Bucket | Visibilité | Créé par (migration) | Contenu |
|---|---|---|---|
| `company-assets` | **public** | `20260409114837_...sql` (`INSERT INTO storage.buckets ... public=true`, implicite via policy `Public read`) | Logos d'entreprise, pièces jointes PDF d'email (`email-attachments/...`) |
| `intervention-photos` | **privé** (passé de public à privé le 23/03) | créé public dans `20260323183616_...sql`, repassé privé dans `20260323201513_...sql` et `20260323211510_...sql` | Photos prises lors des interventions terrain |
| `intervention-signatures` | **privé** (idem) | même migrations que ci-dessus | Signatures clients (base64 → image) |
| `quote-assets` | **privé** | `20260416092505_cf4994dd-...sql` (`public: false` dès la création) | Fichiers/pièces jointes liés aux devis, uploadés depuis le formulaire mobile de devis |

### Structure des chemins

- `intervention-photos/` et `intervention-signatures/` : `{userId}/{uuid}.{ext}` (ext = `jpg` ou `png`), généré dans `src/lib/storageUpload.ts::uploadBase64`.
- `quote-assets/` : `{userId}/...` — la policy INSERT impose `(storage.foldername(name))[1] = auth.uid()::text` (`src/pages/mobile/MobileDevisForm.tsx`).
- `company-assets/` :
  - logos d'entreprise : chemin géré par `SuperAdminCompanies.tsx` / `PdfSettingsTab.tsx` (**À VÉRIFIER** le pattern exact du chemin, non figé dans une convention de dossier stricte observée).
  - pièces jointes email : `email-attachments/{uuid}.pdf` (`src/lib/sendEmailAG.ts`).

### Mécanisme d'upload

- **`src/lib/storageUpload.ts`** : fonctions `uploadBase64`, `uploadPhotos`, `uploadSignature`. Convertit un data-URL base64 en `Uint8Array`, upload via `supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert:false })`, puis retourne directement une **URL signée (TTL 3600s)** plutôt que le chemin brut.
- **`src/components/mobile/PhotoCapture.tsx`** : ne fait pas l'upload lui-même — il capture/compresse (canvas, max 1200px, JPEG qualité 0.7) et conserve les photos en base64 dans le state React ; c'est un composant en amont qui alimente ensuite `uploadPhotos`/`uploadBase64` ailleurs dans le flux de sauvegarde de fiche.
- Autres appels directs `.storage.from(...)` trouvés dans le code front :
  - `src/pages/super-admin/SuperAdminCompanies.tsx` — upload + `getPublicUrl` sur `company-assets`.
  - `src/lib/sendEmailAG.ts` — upload PDF + `getPublicUrl` sur `company-assets`.
  - `src/lib/pdfConfig.ts` — lecture logo (`getPublicUrl` sur `company-assets`) + `createSignedUrl` générique pour d'autres buckets.
  - `src/pages/mobile/MobileDevisForm.tsx` — upload + `getPublicUrl` sur `quote-assets` (**À VÉRIFIER** : le bucket est privé, `getPublicUrl` renverra donc une URL non fonctionnelle sans policy publique — potentiel écart fonctionnel préexistant, hors périmètre de la migration).
  - `src/hooks/useSignedUrl.ts` — génération/rafraîchissement d'URLs signées génériques.

### Relecture des fichiers : URL publique vs signée

- **`company-assets`** (public) : lecture via `getPublicUrl()`, aucune expiration, accessible sans authentification.
- **`intervention-photos` / `intervention-signatures`** (privés) : lecture exclusivement via `createSignedUrl(path, 3600)` — TTL **1 heure**. Le hook `useSignedUrls` (`src/hooks/useSignedUrl.ts`) sait re-signer une URL déjà signée en extrayant `bucket`/`path` depuis le pattern `/storage/v1/object/sign/<bucket>/<path>` (ou `/public/<bucket>/<path>`), et rafraîchit à chaque montage/consultation.
- **`quote-assets`** (privé) : lecture via `createSignedUrl` (via `pdfConfig.ts`) — TTL 3600s également, pattern identique.

### Policies storage (`storage.objects`)

Empilement de migrations successives (RLS réécrite plusieurs fois) ; état final observé :

- **`company-assets`** :
  - `SELECT` public (`Public read company assets`, bucket public).
  - `INSERT`/`UPDATE`/`DELETE` réservés à `is_super_admin()` (policies "SA ...") puis étendus à `is_admin_or_bureau() OR is_super_admin()` (migration `20260409165806_...sql`, policies "Company admins can ... assets").
- **`intervention-photos` / `intervention-signatures`** :
  - Plusieurs itérations : d'abord accès `authenticated` large, puis restriction à `bucket_id IN (...)`, puis policies nommées par bucket avec vérification d'appartenance à l'entreprise (`Company members can view intervention photos/signatures`, migrations `20260409150405_...sql`, `20260409171020_...sql`, `20260504172357_...sql`).
  - Une policy DELETE existe conditionnée par appartenance à l'entreprise (migration `20260409142644_...sql`).
- **`quote-assets`** :
  - `SELECT` : `bucket_id='quote-assets' AND storage_file_belongs_to_my_company(name)` (fonction utilitaire SQL testant l'appartenance via le nom de fichier/`company_id`).
  - `INSERT` : `(storage.foldername(name))[1] = auth.uid()::text` + rôle autorisé (`is_admin_or_bureau()` ou `can_create_devis_db()`).
  - `DELETE` : admin/bureau de la même entreprise, ou propriétaire du fichier.
  - Ces policies ont été resserrées à plusieurs reprises (migrations `20260416133953_...`, `20260416141555_...`, `20260504172357_...`, `20260611095823_...`) — dernière version fait référence au schéma `private.*` pour les fonctions utilitaires.

**Fonctions utilitaires clés référencées par les policies** : `is_super_admin()`, `is_admin_or_bureau()`, `storage_file_belongs_to_my_company(name)` (ou `private.storage_file_belongs_to_my_company`), `can_create_devis_db()`. **À VÉRIFIER** : confirmer si ces fonctions vivent dans `public` ou `private` selon la version la plus récente appliquée en base (les migrations montrent une bascule progressive vers le schéma `private`).

### Ce qu'il faudra recréer après migration

1. **Les 4 buckets** avec leur visibilité exacte (`company-assets` public ; les 3 autres privés) et leurs limites (taille max/mime types si configurées côté dashboard Supabase — **À VÉRIFIER**, non géré en SQL).
2. **Toutes les policies RLS sur `storage.objects`** listées ci-dessus, dans l'ordre de la dernière migration effective (attention aux `DROP POLICY IF EXISTS` en cascade — reprendre l'état final, pas l'historique).
3. Les **fonctions SQL utilitaires** (`is_super_admin`, `is_admin_or_bureau`, `storage_file_belongs_to_my_company`, `can_create_devis_db`) dont dépendent les policies.
4. Aucune dépendance de domaine externe pour le stockage lui-même : les URLs (publiques ou signées) sont générées dynamiquement via le SDK Supabase à partir de `SUPABASE_URL` — un changement de projet/domaine Supabase se répercute automatiquement sans code à changer, **à condition que le nouveau projet ait les mêmes buckets/policies**. Le seul point cassant serait un changement d'`SUPABASE_URL` non reflété dans les variables d'environnement front (`VITE_SUPABASE_URL`/équivalent) — **À VÉRIFIER** nom exact des variables utilisées dans `src/integrations/supabase/client.ts`.
5. Les données elles-mêmes (fichiers binaires) doivent être migrées physiquement (copie objet par objet) si changement de projet Supabase — ce n'est pas une opération SQL.

---

## Partie B — Emails

### Architecture générale

Le système d'email transactionnel repose sur :
1. Une **file d'attente Postgres** via l'extension **pgmq** (deux queues : `auth_emails` prioritaire, `transactional_emails`), plus leurs DLQ (`*_dlq`).
2. Des **Edge Functions** Supabase :
   - `send-transactional-email` : point d'entrée appelé par le front (`supabase.functions.invoke`), résout le template, vérifie la liste de suppression, gère/crée un token de désinscription, puis **enqueue** le message (via RPC `enqueue_email`) — le code visible ne montre pas d'envoi HTTP direct dans cette fonction, elle prépare et pousse en queue.
   - `process-email-queue` : worker déclenché par **cron pg_cron toutes les 5 secondes**, lit un batch de messages (`read_email_batch` RPC), les envoie via **`npm:@lovable.dev/email-js`** (`sendLovableEmail`), gère retries/429/403, TTL par queue (15 min pour `auth_emails`, 60 min pour `transactional_emails`), et journalise chaque tentative dans `email_send_log`.
   - `preview-transactional-email` : rend les templates React Email pour prévisualisation, protégé par vérification d'un header contenant `LOVABLE_API_KEY` (appelé uniquement par l'API Go de Lovable selon le commentaire du code).
   - `handle-email-unsubscribe` : gère le lien de désinscription (GET = validation token, POST = désinscription effective, supporte le one-click RFC 8058), ajoute l'email à `suppressed_emails`.
   - `handle-email-suppression` : webhook entrant, **signé HMAC via `LOVABLE_API_KEY`** (`npm:@lovable.dev/webhooks-js`), reçoit les événements de bounce/complaint/unsubscribe remontés par Mailgun **via l'API Go de Lovable** (commentaire explicite dans le code : "Suppression event payload sent by the Go API when Mailgun reports a bounce, complaint, or unsubscribe").
3. Des **templates React Email** dans `supabase/functions/_shared/transactional-email-templates/` : `fiche-intervention.tsx`, `rappel-entretien.tsx`, référencés dans un registre central `registry.ts` (map `templateName → { component, subject, previewData, to }`).
4. Une **configuration par entreprise** : table `email_settings` (clé `template_key` + `company_id`, objet/texte d'intro/signature/coordonnées de contact, options d'auto-rappel), éditable via `EmailSettingsTab.tsx` (composant admin, formulaire Zod).
5. Un **appel front** centralisé dans `src/lib/sendEmailAG.ts` : deux fonctions métier, `sendFicheToAG` (envoi manuel de la fiche d'intervention en PDF, upload préalable du PDF sur `company-assets` en public puis passage de l'URL au template) et `sendEntretienReminderToAG` (rappel d'entretien). Toutes deux appellent `supabase.functions.invoke("send-transactional-email", ...)`.
6. Une fonction planifiée **`send-entretien-reminders`** (edge function séparée, probablement aussi sur cron — **À VÉRIFIER** le déclencheur exact, non trouvé de `cron.schedule` dédié dans les migrations grep) qui parcourt `maintenance_schedules` dont l'échéance approche, vérifie `email_settings.auto_reminder_enabled`/`reminder_days_before` par entreprise, et appelle en HTTP interne `send-transactional-email` pour chaque client concerné, puis marque `reminder_sent_at`.

### Tables impliquées

- `email_send_log` : journal d'audit de tous les envois (`pending/sent/suppressed/failed/bounced/complained/dlq`), avec `message_id`, contrainte d'unicité partielle empêchant le double-envoi d'un même `message_id` marqué `sent`.
- `email_send_state` : ligne unique (id=1) pilotant le throttling (`retry_after_until`, `batch_size`, `send_delay_ms`, TTL par queue).
- `email_unsubscribe_tokens` : un token unique par adresse email, marqué `used_at` lors de la désinscription.
- `suppressed_emails` : liste de suppression globale (bounce/complaint/unsubscribe), vérifiée avant tout envoi (fail-closed : en cas d'erreur de lecture, l'envoi est bloqué).
- `email_settings` : configuration des templates par entreprise (`template_key`, `company_id`).

### Flux complet (cas `sendFicheToAG`)

1. Front génère le PDF de fiche (jsPDF), l'upload dans `company-assets/email-attachments/{uuid}.pdf`, récupère l'URL publique.
2. Front appelle `send-transactional-email` avec `templateName`, `recipientEmail`, `templateData` (dont `pdfUrl`).
3. La fonction vérifie `suppressed_emails`, crée/récupère un `unsubscribe_token`, résout le template React (`fiche-intervention.tsx`), pousse le message en queue `transactional_emails` via `enqueue_email` RPC.
4. Le cron `pg_cron` (toutes les 5s) déclenche `process-email-queue` via `net.http_post` avec la clé `service_role` stockée dans **Supabase Vault** (`email_queue_service_role_key`).
5. `process-email-queue` lit le batch, appelle `sendLovableEmail(...)` avec `apiKey = LOVABLE_API_KEY` et optionnellement `sendUrl = LOVABLE_SEND_URL` (sinon endpoint par défaut `https://api.lovable.dev`).
6. Résultat journalisé dans `email_send_log`, message supprimé de la queue si succès, sinon retry (jusqu'à `MAX_RETRIES = 5`) ou passage en DLQ (TTL dépassé, 403, ou retries épuisés).
7. Si le destinataire clique sur « se désabonner » : `handle-email-unsubscribe` marque le token utilisé et ajoute l'email à `suppressed_emails`.
8. Si Mailgun (via l'infrastructure Lovable) signale un bounce/complaint : `handle-email-suppression` reçoit un webhook signé et met à jour `suppressed_emails` + `email_send_log`.

### Domaine d'envoi utilisé

Constantes codées en dur dans `send-transactional-email/index.ts` :
- `SENDER_DOMAIN = "notify.agchauffage.be"` — sous-domaine technique délégué aux nameservers de Lovable pour l'envoi réel (SPF/DKIM gérés côté Lovable).
- `FROM_DOMAIN = "agchauffage.be"` — domaine affiché dans l'en-tête `From:` (option `display_from_root`).
- `SITE_NAME = "ground-crew-grid"` (nom du projet Lovable).

Un commentaire du code prévient explicitement : *"Configuration baked in at scaffold time — do NOT change these manually. To update, re-run the email domain setup flow."* — cette configuration est donc **couplée à l'infrastructure Lovable Email** et **ne survivra pas telle quelle** à une migration hors Lovable.

### Dépendances vis-à-vis de l'infrastructure Lovable Email

Ce qui dépend directement de Lovable et **devra être recréé avec un fournisseur propre (Resend, Postmark, Mailgun direct, SES…)** :

1. **Package `npm:@lovable.dev/email-js`** utilisé dans `process-email-queue` pour l'envoi réel — à remplacer par le SDK du nouveau fournisseur.
2. **`LOVABLE_API_KEY`** (secret) : utilisé pour l'envoi (`process-email-queue`), la vérification d'accès à `preview-transactional-email`, et la vérification HMAC des webhooks de suppression (`handle-email-suppression`) — à remplacer par la clé API du nouveau fournisseur et un mécanisme de signature équivalent (ex. webhook signing secret Resend/Postmark).
3. **`LOVABLE_SEND_URL`** (optionnel) : override de l'endpoint d'envoi — non pertinent avec un autre fournisseur.
4. **Package `npm:@lovable.dev/webhooks-js`** (vérification HMAC des webhooks entrants) dans `handle-email-suppression` — à remplacer par la vérification de signature propre au nouveau fournisseur (souvent différente, ex. `svix` pour Resend).
5. **Le sous-domaine `notify.agchauffage.be` délégué aux nameservers de Lovable** : à reconfigurer intégralement (DNS, SPF, DKIM, DMARC) chez le nouveau fournisseur, avec mise à jour de `SENDER_DOMAIN`/`FROM_DOMAIN` en dur dans le code.
6. **La gestion des bounces/complaints via Mailgun + API Go Lovable** (webhook `handle-email-suppression`) : entièrement à reconstruire — le nouveau fournisseur a son propre format de webhook et son propre mécanisme de signature à adapter dans le parsing (`parseSuppressionPayload`).
7. **`preview-transactional-email`** : gated par `LOVABLE_API_KEY`, présumé appelé exclusivement par la plateforme Lovable (éditeur de templates) — fonctionnalité de confort à réévaluer ou reconstruire indépendamment.

Ce qui **ne dépend pas** de Lovable et est réutilisable tel quel :
- La structure pgmq (queues, DLQ, RPC wrappers `enqueue_email`/`read_email_batch`/`delete_email`/`move_to_dlq`).
- Le cron `pg_cron` déclenchant le worker toutes les 5 secondes (mécanisme générique).
- Les tables `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`, `email_settings` et leurs policies RLS.
- Les templates React Email (`fiche-intervention.tsx`, `rappel-entretien.tsx`) — le rendu HTML (`renderAsync` de `@react-email/components`) est indépendant du fournisseur d'envoi, seul l'appel final change.
- La logique métier front (`src/lib/sendEmailAG.ts`, `EmailSettingsTab.tsx`).

### Ce qu'il faudra recréer après migration (partie B)

1. Compte chez un fournisseur email (Resend/Postmark/SES…), domaine vérifié (SPF/DKIM/DMARC) — probablement un sous-domaine du domaine final choisi.
2. Réécriture de `process-email-queue` : remplacer `sendLovableEmail` par l'appel HTTP/SDK du nouveau fournisseur, adapter la gestion des erreurs 429/403 au format du nouveau fournisseur.
3. Réécriture de `handle-email-suppression` : nouveau format de payload webhook + nouvelle méthode de vérification de signature.
4. Suppression ou adaptation de `preview-transactional-email` (dépendance forte à `LOVABLE_API_KEY` et à l'éditeur Lovable).
5. Mise à jour des secrets Supabase (`LOVABLE_API_KEY` → clé du nouveau fournisseur, ajout d'un secret de signature webhook dédié).
6. Mise à jour en dur de `SENDER_DOMAIN`/`FROM_DOMAIN`/`SITE_NAME` dans `send-transactional-email/index.ts`.
7. Revalider le cron `pg_cron` + le secret Vault `email_queue_service_role_key` après toute migration de projet Supabase (le secret est stocké côté base, pas dans le code).

---

## Partie C — Notifications

### Realtime Supabase (in-app, temps réel)

Usages de `.channel(...)` recensés dans `src/` :

| Fichier | Canal | Usage |
|---|---|---|
| `src/hooks/useRealtimeQuotes.ts` | nom dynamique | Suivi des changements sur les devis |
| `src/components/dashboard/RecentSheetsPanel.tsx` | `dashboard-sheets` | Rafraîchissement du panneau des fiches récentes |
| `src/components/dashboard/bureau/BureauDashboard.tsx` | `bureau-dashboard` | Rafraîchissement du dashboard bureau |
| `src/components/layout/RealtimeOrderNotifications.tsx` | `bureau-orders`, `bureau-order-updates`, `bureau-sheets`, `bureau-quotes` | Notifications temps réel multi-canaux pour le rôle bureau (commandes, fiches, devis) |
| `src/components/mobile/MobileTaskNotifications.tsx` | `mobile-task-changes` | Notification des changements de tâches côté mobile |

**Fonctionnement** : ces canaux s'appuient sur `supabase.channel(...).on('postgres_changes', ...)` (Supabase Realtime, basé sur la réplication logique Postgres + WebSocket). Les tables concernées doivent être ajoutées à la publication `supabase_realtime` (vu par exemple `ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;` dans `20260416092505_...sql`).

**Dépendances** : uniquement `SUPABASE_URL`/clé anon côté client — aucune dépendance à Lovable. Un changement de projet Supabase nécessite de revérifier que les tables utilisées sont bien ajoutées à `supabase_realtime` et que RLS autorise le `SELECT` nécessaire à la réplication filtrée.

**Ce qu'il faut recréer après migration** : rien de spécifique à Lovable ; juste s'assurer que la publication `supabase_realtime` inclut les mêmes tables sur le nouveau projet/domaine.

### Notifications push (mobile natif)

- **`src/hooks/usePushNotifications.ts`** : utilise `@capacitor/push-notifications` (uniquement actif si `Capacitor.isNativePlatform()`). Demande la permission, `PushNotifications.register()` (enregistrement FCM natif Android via Capacitor), puis upsert du token dans la table `push_tokens` (`onConflict: "token"`). Écoute aussi la réception en foreground (affichage d'un toast `sonner`) et le tap sur notification (navigation interne sécurisée par regex anti-open-redirect).
- **Table `push_tokens`** (`user_id`, `token` unique, `platform` par défaut `android`) avec RLS : chaque utilisateur gère ses propres tokens (`auth.uid() = user_id`), admin/secrétariat/super-admin peuvent tout lire.
- **Edge function `send-push`** : vérifie que l'appelant a un rôle `admin`/`bureau`/`super_admin`, restreint les destinataires à la même entreprise (sauf super_admin), récupère les tokens dans `push_tokens`, envoie via **l'API FCM legacy HTTP** (`https://fcm.googleapis.com/fcm/send`) avec le secret `FCM_SERVER_KEY`. Nettoie automatiquement les tokens invalides (`InvalidRegistration`/`NotRegistered`).

**Dépendances** : `FCM_SERVER_KEY` (secret Firebase Cloud Messaging, indépendant de Lovable), `@capacitor/push-notifications` + `@capacitor/core` côté app native. **Aucune dépendance directe à l'infrastructure email Lovable.**

**Ce qui casse au changement de domaine** : rien côté push lui-même (FCM ne dépend pas du domaine web) — en revanche, si l'app mobile encode le domaine de l'API Supabase en dur (URL de redirection ou deep links `route` utilisés dans `pushNotificationActionPerformed`), il faut vérifier la cohérence de ces routes avec le nouveau domaine front. **À VÉRIFIER** : configuration Capacitor (`capacitor.config.ts`) pour d'éventuelles URLs codées en dur.

**Ce qu'il faudra recréer après migration** : rien de spécifique à Lovable ; l'API FCM utilise l'API legacy `fcm.googleapis.com/fcm/send` qui est **dépréciée par Google** (migration vers HTTP v1 recommandée par Google indépendamment de ce projet) — **À VÉRIFIER** si une migration FCM v1 est prévue séparément, hors périmètre Lovable.

### Notifications in-app (toasts)

- Utilisation de la librairie `sonner` (`toast.success/error/info`) déclenchée en réaction aux événements realtime ou aux résultats d'actions utilisateur (ex. réception push en foreground, erreurs de sauvegarde, etc.).
- Purement front, aucune dépendance à Lovable ni à un domaine particulier.

---

## Synthèse — Éléments à recréer après la migration hors Lovable

| Domaine | Élément | Action requise |
|---|---|---|
| Stockage | 4 buckets + policies RLS `storage.objects` | Recréer à l'identique sur le nouveau projet Supabase, migrer les objets binaires |
| Stockage | Fonctions SQL utilitaires (`is_super_admin`, `is_admin_or_bureau`, `storage_file_belongs_to_my_company`, `can_create_devis_db`) | Recréer, dépendance des policies storage |
| Email | Fournisseur d'envoi (`@lovable.dev/email-js` → SDK du nouveau fournisseur) | Réécrire `process-email-queue` |
| Email | Vérification webhooks entrants (`@lovable.dev/webhooks-js`) | Réécrire `handle-email-suppression` avec le mécanisme du nouveau fournisseur |
| Email | Domaine d'envoi (`notify.agchauffage.be` / `agchauffage.be`) | Reconfigurer DNS/SPF/DKIM/DMARC, mettre à jour les constantes en dur |
| Email | Secrets (`LOVABLE_API_KEY`, `LOVABLE_SEND_URL`) | Remplacer par les secrets du nouveau fournisseur |
| Email | `preview-transactional-email` | Réévaluer l'usage (dépend de l'éditeur Lovable) |
| Email | pgmq, cron, tables (`email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`, `email_settings`) | Réutilisables tels quels |
| Notifications | Realtime Supabase | Vérifier publication `supabase_realtime` sur le nouveau projet |
| Notifications | Push FCM (`push_tokens`, `send-push`, `FCM_SERVER_KEY`) | Indépendant de Lovable, à conserver tel quel (surveiller dépréciation FCM legacy côté Google) |
| Notifications | Toasts in-app (`sonner`) | Aucune action |

