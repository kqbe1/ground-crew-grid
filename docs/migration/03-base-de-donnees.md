# 03 — Base de données

Base actuelle : **PostgreSQL Supabase** (projet géré par Lovable Cloud, région `aws-1-eu-west-1`, taille d'instance « Tiny »). Schéma applicatif : `public` + schéma technique `private` (fonctions de sécurité).

Toutes les données applicatives sont **déjà** dans Supabase. La migration ne consiste donc pas à changer de moteur, mais à **transférer le projet Supabase géré par Lovable vers un projet Supabase possédé par vous** (ou à conserver ce projet si Lovable permet le transfert de propriété — **À VÉRIFIER** auprès du support).

---

## 1. Vue d'ensemble

- 26 tables dans `public`
- 11 types ENUM
- 18 fonctions `public` + ~15 fonctions `private`
- 47 triggers
- 2 jobs `pg_cron` permanents + 1 job éphémère (`process-email-queue`)
- Extensions utilisées : `pg_cron`, `pg_net`, `pgmq`, `vault`, `pgcrypto`

Volumétrie constatée au moment de l'audit (utile pour dimensionner l'export) :

| Table | Lignes |
|---|---|
| auth.users | 12 |
| companies | 2 |
| profiles | 11 |
| clients | 5 |
| work_tasks | 9 |
| intervention_sheets | 3 |
| maintenance_schedules | 2 |
| parts_orders | 4 |
| quotes | 0 |
| activity_logs | 1 159 |
| email_send_log | 0 |
| push_tokens | 0 |

→ La base est **très petite**. Un `pg_dump` / restauration complète est parfaitement réalisable, ce qui réduit fortement le risque de migration de données.

---

## 2. Types ENUM (à recréer en premier dans toute nouvelle base)

| Type | Valeurs |
|---|---|
| `app_role` | admin, ouvrier, super_admin, bureau |
| `energy_type` | gaz, mazout, pellets, electricite, clim, vmc, autre, boiler |
| `installation_type` | chaudiere, climatisation, vmc, salle_de_bain, autre |
| `intervention_type` | entretien_gaz, entretien_mazout, entretien_pellets, entretien_clim, entretien_vmc, depannage, installation, remplacement, rdv_divers, autre, entretien_boiler |
| `maintenance_periodicity` | mensuel, trimestriel, semestriel, annuel, bisannuel, triennal |
| `order_status` | demandee, commandee, recue, cloturee |
| `order_urgency` | normal, urgent, critique |
| `quote_status` | en_attente, dossier_en_cours, en_commande, sav, cloture |
| `task_status` | planifie, termine, a_replanifier, piece_a_commander, sav |
| `worker_level` | T0, T1, T2, T3, T4, T5 |

⚠️ **Incohérence détectée** : l'ENUM `worker_level` s'arrête à `T5` en base, alors que `src/lib/constants.ts` propose des labels techniciens jusqu'à T20. Toute tentative d'attribuer T6+ échouera côté base. **À VÉRIFIER / à corriger** (étendre l'ENUM ou limiter l'UI).

---

## 3. Tables

Convention commune : PK `id uuid default gen_random_uuid()`, `created_at`/`updated_at timestamptz default now()`, `company_id uuid` porteur de l'isolation multi-tenant, trigger `set_company_id()` en BEFORE INSERT et `update_updated_at_column()` en BEFORE UPDATE.

### 3.1 Socle multi-tenant

#### `companies`
- Colonnes : `id`, `name` (NN), `slug` (NN, **unique**), `display_name`, `logo_url`, `primary_color` (def `#1B4F72`), `secondary_color` (def `#2E86C1`), `contact_email`, `contact_phone`, `address`, `plan` (def `standard`), `max_users` (def 25), `is_active` (def true), `subscription_start`, `subscription_end`, `notes`, `created_at`, `updated_at`.
- PK `id`. Aucune FK sortante. Référencée par presque toutes les tables via `company_id`.
- Index : `companies_pkey`, `companies_slug_key` (unique).
- Triggers : `trg_log_company_changes` (INSERT/UPDATE → `activity_logs`), `update_companies_updated_at`.
- Sensible : non (données d'entreprise).
- ⚠️ Particularité : le rôle `authenticated` n'a **pas** le privilège `SELECT` sur cette table (seulement I/U/D). La lecture passe par la fonction `public.get_my_company_full()`. À reproduire à l'identique sinon l'affichage du logo/nom d'entreprise casse.

#### `profiles`
- Colonnes : `id uuid` (PK **et** FK → `auth.users.id`), `full_name` (NN), `email`, `phone`, `worker_level` (enum), `is_active` (NN, def true), `avatar_url`, `created_at`, `updated_at`, `company_id` (FK → companies, **nullable** : NULL = super admin), `role app_role` (def `ouvrier`), `can_create_devis` (NN, def false), `display_order` (NN, def 0).
- Index : `profiles_pkey`, `idx_profiles_company`, `idx_profiles_role`.
- Triggers : `sync_user_role_trigger` (réplique `role` dans `user_roles`), `trg_log_profile_changes`, `trg_restrict_user_profile_update` (empêche l'auto-élévation de privilèges), `update_profiles_updated_at`.
- Création automatique : trigger `on_auth_user_created` sur `auth.users` → `handle_new_user()`.
- **Données sensibles** : email, téléphone, rôle.
- INSERT et DELETE sont refusés par RLS (création uniquement via le trigger auth, suppression via edge function `service_role`).

#### `user_roles`
- Colonnes : `id`, `user_id` (FK → `auth.users`, ON DELETE CASCADE), `role app_role` (NN), `created_at`. Unique `(user_id, role)`.
- Table alimentée **automatiquement** par le trigger `sync_user_role()` depuis `profiles.role`.
- ⚠️ **Point d'architecture important** : la source de vérité du rôle est `profiles.role`, pas `user_roles`. Les fonctions de sécurité (`private.get_my_role`, `private.has_role`) lisent `profiles`. `user_roles` est donc aujourd'hui une **table miroir** non utilisée pour les décisions d'autorisation. C'est contraire à la bonne pratique (rôle stocké sur la table de profil = risque d'élévation si une policy d'update est trop permissive) — la protection actuelle repose entièrement sur le trigger `restrict_user_profile_update()` et sur le CHECK de la policy `own_update`. À réévaluer lors de la migration (voir doc 04).

### 3.2 Clients

#### `clients`
- `id`, `name` (NN), `email`, `phone`, `phone_secondary`, `address_intervention`, `address_billing`, `contact_syndic`, `contact_locataire`, `notes_internal`, `syndic_keys_codes`, `birthday date`, `postal_code`, `city`, `owner_client_id` (FK auto-référente → clients : client propriétaire d'un locataire), `company_id` (NN, FK), timestamps.
- Index : pkey, `idx_clients_company`, `clients_owner_client_id_idx`.
- **Données sensibles** : coordonnées personnelles, `syndic_keys_codes` (codes d'accès/clés — donnée à haute sensibilité), `notes_internal`.

#### `client_sites`
- `id`, `client_id` (NN, FK), `name` (NN), `address` (NN), `postal_code`, `city`, `notes`, `is_primary` (NN def false), `company_id` (NN), timestamps.
- Index : pkey, `idx_client_sites_client`, `idx_client_sites_company`.
- Règle : un site « Adresse principale » est créé automatiquement à la création d'un client (logique **frontend**, pas de contrainte base).

#### `client_equipment`
- `id`, `client_site_id` (NN, FK), `name` (NN), `energy_type` (NN def `autre`), `brand`, `model`, `maintenance_periodicity`, `last_maintenance_date`, `next_maintenance_date`, `notes`, `company_id` (NN), timestamps.
- Index : pkey, `idx_client_equipment_site`, `idx_client_equipment_company`.

### 3.3 Planning et interventions

#### `work_tasks`
- `id`, `title` (NN), `description`, `intervention_type` (NN def `autre`), `status task_status` (NN def `planifie`), `scheduled_date date` (NN), `start_time time` (NN), `duration_minutes` (NN def 60), `assigned_to` (FK profiles), `second_assigned_to` (FK profiles), `binome_id` (FK task_binomes), `client_id`, `client_site_id`, `equipment_id`, `template_id`, `memo_secretariat`, `material_needed`, `created_by`, `wait_reason`, `company_id` (NN), timestamps.
- Index : pkey, `idx_work_tasks_company`, `idx_work_tasks_date`, `idx_work_tasks_status`, `idx_work_tasks_assigned`, `idx_work_tasks_client`.
- Triggers : `set_company_id_work_tasks`, `trg_restrict_ouvrier_task_update` (un ouvrier ne peut modifier ni l'affectation, ni le client, ni la planification, ni le mémo secrétariat), `update_work_tasks_updated_at`.
- Table centrale : c'est le pivot du planning et des fiches.

#### `work_task_assignees`
- Table de liaison multi-ouvriers : `id`, `work_task_id` (NN), `user_id` (NN), `company_id` (NN), `created_at`. Unique `(work_task_id, user_id)`. UPDATE refusé par RLS (create/delete uniquement).
- ⚠️ Coexiste avec `assigned_to` / `second_assigned_to` sur `work_tasks` : **double modèle d'affectation**. À rationaliser après migration (risque d'incohérence).

#### `intervention_sheets`
- 50 colonnes. Clés : `work_task_id` (NN, FK), `worker_id` (FK profiles), `arrival_time`, `departure_time`, `description`, `checklist_results jsonb`, `photos_before/photos_after/photos_nameplate/internal_photos` (text[]), `nameplate_data jsonb`, `final_status task_status` (NN def `termine`), `client_present`/`client_absent`, `signature_data text` (data URL ou chemin storage), `signed_at`, `is_draft` (NN def false), `sent_to_client` (NN def false), `supplies_description`, `internal_comment`, `observations_before`, bloc facturation (`billing_*`), bloc surcharge client (`client_*_override`), `entretien_type`, `entretien_subtype jsonb`, `binome_name`, `binome_percentage`, `work_status_detail`, `status_comment`, `work_status_details text[]`, `work_status_notes jsonb`, `company_id` (NN).
- Index : pkey, `idx_intervention_sheets_task`, `idx_intervention_sheets_company`.
- **Données sensibles** : signature manuscrite du client, photos de sites privés, coordonnées de facturation.
- ⚠️ Colonnes redondantes/héritées : `work_status_detail` + `status_comment` (ancien modèle mono-statut) coexistent avec `work_status_details` + `work_status_notes` (nouveau modèle multi-statuts), et `binome_percentage` n'est plus utilisé. À nettoyer après migration, pas pendant.

#### `task_templates`
- `id`, `name` (NN), `intervention_type` (NN def `autre`), `description`, `default_duration_minutes` (NN def 60), `checklist jsonb` (def `[]`), `created_by`, `company_id` (NN), timestamps.

#### `task_binomes` (binômes actifs, code B0–B20)
- `id`, `company_id` (NN), `code` (NN), `kind` (NN def `stagiaire`), `name` (NN), `is_active` (NN def true), timestamps. Unique `(company_id, code)`.
- Trigger `enforce_task_binomes_limit` : maximum **20 binômes actifs** par entreprise (règle métier en base).

#### `binomes` (⚠️ table héritée)
- `id`, `name`, `user1_id`, `user2_id`, `user1_percentage`, `user2_percentage`, `is_active`, `company_id`, timestamps.
- **Aucune référence dans le code frontend** (`rg .from("binomes")` = 0 résultat ; seul `task_binomes` est utilisé). Table **obsolète** : à ne pas migrer, ou à migrer vide pour compatibilité. **À VÉRIFIER** qu'elle ne contient pas de données historiques utiles avant suppression.

### 3.4 Entretiens récurrents

#### `maintenance_schedules`
- `id`, `client_id` (NN), `client_site_id`, `equipment_id`, `intervention_type` (NN), `periodicity` (NN def `annuel`), `last_done_date`, `next_due_date date` (NN), `status text` (def `actif`), `legal_alert_years int`, `notes`, `reminder_sent_at`, `reminder_sent_for_date`, `binome_id`, `company_id` (NN), timestamps.
- Index : pkey, `idx_maintenance_schedules_company`, `idx_maintenance_next_due`.
- `reminder_sent_at` / `reminder_sent_for_date` = idempotence des rappels e-mail (voir doc 06).

#### `maintenance_schedule_assignees`
- Liaison ouvriers ↔ entretien. Unique `(maintenance_schedule_id, user_id)`. UPDATE refusé.
- ⚠️ La création d'entretien ne permet plus d'assigner d'ouvriers (décision métier). Cette table est donc probablement **inutilisée aujourd'hui**. **À VÉRIFIER** (contenu réel) avant de la conserver.

#### `legal_maintenance_rules`
- `id`, `company_id` (nullable = règle globale), `energy_type text` (NN), `region text` (NN), `periodicity text` (NN), `notes`, timestamps. Unique `(company_id, energy_type, region)`.
- Sert au calcul des échéances légales belges (Wallonie / Flandre / Bruxelles).

### 3.5 Commandes de pièces

#### `parts_orders`
- `id`, `work_task_id` (FK, nullable en base), `client_id`, `requested_by` (NN, FK profiles), `part_name` (NN), `part_reference`, `quantity` (NN def 1), `status order_status` (NN def `demandee`), `urgency order_urgency` (NN def `normal`), `notes`, `supplier`, `photos text[]`, `ordered_at`, `received_at`, `closed_at`, `company_id` (NN), timestamps.
- Index : pkey, `idx_parts_orders_company`, `idx_parts_orders_client`, `idx_parts_orders_status`.
- Note : le lien à une tâche est **obligatoire côté UI** mais `work_task_id` reste nullable en base — règle métier non garantie par la base.

### 3.6 Devis / dossiers

#### `quotes`
- `id`, `company_id` (NN), `created_by`, `status quote_status` (NN def `en_attente`), bloc client (`client_name` NN, adresse, CP, ville, téléphone, email), bloc facturation, `installation_type` (NN def `autre`), `rooms_data jsonb`, `plan_photos jsonb`, `is_urgent`, `existing_installation_remove/complete`, `work_description`, `checklist_data jsonb`, `photos jsonb`, `voice_notes jsonb`, `internal_comments jsonb`, timestamps.
- Index : pkey, `idx_quotes_company_id`, `idx_quotes_status`, `idx_quotes_created_by`.
- ⚠️ **0 ligne** actuellement : module fonctionnel mais non encore utilisé en production.
- ⚠️ Rappel de périmètre : il s'agit de **relevés/dossiers techniques**, pas de facturation.

### 3.7 Configuration

#### `pdf_settings`
- Configuration PDF **par entreprise et par type de document** : unique `(company_id, document_type)`. Contient identité société, `logo_url`, `document_title`, `primary_color`, une dizaine de booléens `show_*`, `footer_text` et `text_blocks jsonb` (blocs libres configurables).

#### `email_settings`
- Configuration e-mail **par entreprise et par template** : unique `(company_id, template_key)`. `subject`, `intro_text`, `footer_text`, `contact_phone`, `contact_email` (défaut `info@agchauffage.be`), `auto_reminder_enabled`, `reminder_days_before` (def 30).
- ⚠️ Valeurs par défaut **spécifiques à AG Chauffage** codées dans le schéma (`footer_text`, `contact_email`) : à neutraliser pour un vrai SaaS multi-tenant.

#### `platform_settings`
- Réglages globaux de plateforme (`key` unique, `value jsonb`). Ex. `security_monitor_cron_schedule`. Accessible **super admin uniquement**. Trigger `trg_apply_security_monitor_schedule` → reprogramme le cron.

### 3.8 Journalisation et e-mails techniques

- `activity_logs` : `action`, `actor_id`, `target_type`, `target_id`, `company_id`, `metadata jsonb`. UPDATE/DELETE refusés (journal immuable). 1 159 lignes. Index sur action, company_id, created_at DESC.
- `email_send_log` : trace des envois (`message_id`, `template_name`, `recipient_email`, `status`, `error_message`, `metadata`). Index unique partiel sur `message_id WHERE status='sent'` → **garantit l'anti-doublon d'envoi**. Accès `service_role` uniquement.
- `email_send_state` : ligne unique (`id=1`) pilotant la file : `retry_after_until`, `batch_size` (10), `send_delay_ms` (200), TTL auth (15 min) et transactionnel (60 min).
- `email_unsubscribe_tokens` : `token` unique, `email` unique, `used_at`.
- `suppressed_emails` : liste de suppression (bounces/plaintes), `email` unique, `reason`, `metadata`. INSERT/SELECT `service_role` seulement, UPDATE/DELETE refusés.
- `push_tokens` : `user_id`, `token` unique, `platform` (def android). 0 ligne → push jamais enregistré en pratique.

---

## 4. Isolation multi-tenant : synthèse

Mécanisme : **colonne `company_id` + RLS + fonctions `SECURITY DEFINER` du schéma `private`**.

- `private.get_my_company_id()` lit `profiles.company_id` pour `auth.uid()`.
- Toutes les policies applicatives comparent `company_id = private.get_my_company_id()`.
- Le `company_id` est **imposé côté serveur** par le trigger `set_company_id()` en BEFORE INSERT quand il n'est pas fourni. ⚠️ Le trigger n'écrase pas une valeur fournie explicitement, mais le `WITH CHECK` des policies INSERT rejette tout `company_id` étranger. La combinaison des deux est correcte.
- Super admin : `company_id = NULL` + `private.is_super_admin()` ouvre l'accès global.

Tables **sans** `company_id` (et donc hors périmètre tenant, par conception) : `companies`, `user_roles`, `push_tokens`, `platform_settings`, `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`.

---

## 5. Ce qu'il faut faire lors de la migration

### 5.1 À recréer intégralement (structure)
Toutes les tables, ENUM, index, contraintes, triggers, fonctions `public` **et** `private`, policies RLS, GRANT/REVOKE.
→ La façon la plus sûre : `pg_dump --schema-only` du projet actuel, puis restauration, plutôt que de rejouer les 92 migrations (elles contiennent des correctifs successifs et des URL codées en dur).

### 5.2 Relations à conserver impérativement
`profiles.id → auth.users.id` (CASCADE), `*.company_id → companies.id`, `work_tasks → clients / client_sites / client_equipment / task_templates / task_binomes / profiles`, `intervention_sheets.work_task_id → work_tasks.id`, `client_sites.client_id`, `client_equipment.client_site_id`, `clients.owner_client_id` (auto-référence), `parts_orders.work_task_id`, `maintenance_schedules.*`.

⚠️ Ordre de restauration : `auth.users` **avant** `profiles` (sinon la FK casse), et **désactiver le trigger** `on_auth_user_created` pendant l'import des utilisateurs, sinon il tentera de recréer des profils en double.

### 5.3 Données à migrer réellement
`companies`, `profiles`, `auth.users`, `clients`, `client_sites`, `client_equipment`, `work_tasks`, `work_task_assignees`, `intervention_sheets`, `maintenance_schedules`, `parts_orders`, `task_templates`, `task_binomes`, `legal_maintenance_rules`, `pdf_settings`, `email_settings`, `platform_settings`, plus les **fichiers Storage** (voir doc 07).

### 5.4 Données temporaires / non critiques
- `activity_logs` : historique — migrable, mais pas bloquant (peut être archivé à froid).
- `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails` : techniques. `email_send_state` doit être **recréée** avec sa ligne `id=1`. `suppressed_emails` **devrait** être migrée (obligation anti-spam).
- Files `pgmq` (`q_auth_emails`, `q_transactional_emails`) : à vider avant migration, ne pas transférer.
- `push_tokens` : vide, à recréer par les appareils.
- Brouillons de fiches : stockés en **localStorage du navigateur**, jamais en base → non migrables, prévenir les ouvriers de synchroniser avant bascule.

### 5.5 Données calculées (à ne pas migrer)
- Temps de travail (dérivé de `arrival_time`/`departure_time` des fiches).
- Statistiques des tableaux de bord.
- Prochaines échéances légales (dérivées de `legal_maintenance_rules` + équipements).
- Conflits de planning (calcul frontend).
- `user_roles` (régénérée par le trigger depuis `profiles.role`).

### 5.6 Ce qui dépend encore de Lovable
- Le **projet Supabase lui-même** est « Managed by Lovable ».
- Les secrets `LOVABLE_API_KEY` et `LOVABLE_SEND_URL` (IA + envoi d'e-mails).
- L'URL du projet Supabase codée en dur dans les fonctions SQL `email_queue_dispatch()`, `email_queue_wake()` et dans les jobs `pg_cron` (`https://obvvrvcvijyvnnfdcrpg.supabase.co/functions/v1/...`) → **à réécrire** si le ref du projet change.
- Le secret `email_queue_service_role_key` dans `vault` → à recréer.
