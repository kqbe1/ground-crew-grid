# Passage global de corrections avant tests finaux

Objectif : corriger les points listés sans toucher au métier existant, garder RLS/rôles/company_id, aucun déploiement Supabase (migrations écrites en local uniquement), build + dev à la fin.

## 1. Fiches Bureau — date de réception réelle

Constat vérifié : `intervention_sheets` n'a aucune colonne de « réception ». Le dashboard Bureau (`BureauDashboard.tsx`) filtre les 24 h sur `created_at`, donc une fiche créée en brouillon hier et finalisée aujourd'hui n'apparaît pas.

- Nouvelle migration locale : colonne `bureau_received_at timestamptz` sur `intervention_sheets` + trigger qui la remplit au moment où `is_draft` passe à `false` (ou à l'insertion directe en non-brouillon), et backfill des fiches existantes (`coalesce(updated_at, created_at)` pour les fiches déjà finalisées).
- Le dashboard utilise `bureau_received_at` (fallback `created_at`) pour la fenêtre 24 h et pour la colonne date.
- Action **Archiver** ajoutée dans la table du dashboard (`BureauFicheTable.tsx`) : met `bureau_archived`, `bureau_archived_at`, `bureau_archived_by` — mécanisme déjà existant, réutilisé, pas de nouvelle table. La fiche disparaît du dashboard et reste visible dans la page Fiches (filtre « Archivées » déjà présent).
- Aucun changement côté ouvrier.

## 2. Notifications — audit puis correctifs ciblés

Audit à documenter (frontend, tables, triggers, `send-push`, RLS, tokens, déclencheurs) avec pour chaque notification : fonctionnelle / défaillante / cause / correction.

Éléments déjà repérés :
- Temps réel bureau (`RealtimeOrderNotifications`) et ouvrier (`MobileTaskNotifications`) : fonctionnent via Realtime.
- `MobileTaskNotifications` n'écoute que `assigned_to` : un ouvrier assigné en second (`second_assigned_to`) ne reçoit rien → correction.
- `send-push` : dépend du secret `FCM_SERVER_KEY` (absent de la liste des secrets) et utilise l'API FCM legacy fermée par Google. À signaler ; le push natif sera marqué non fonctionnel tant que la clé/API n'est pas fournie, sans casser l'existant.

Seules les notifications réellement défaillantes seront modifiées.

## 3. Conflits horaires — blocage réel

Constat : `findOverlaps` n'est utilisé que pour un `toast.warning` (Planning, CreateTaskDialog).

- Composant partagé d'alerte de conflit : liste des tâches en conflit (titre, horaire, ouvrier concerné), affiché dans le dialogue de création et de modification de tâche.
- Validation bloquée tant qu'un conflit existe (bouton désactivé + message).
- Action directe : champs heure/durée mis en avant pour correction immédiate depuis l'alerte.
- Prise en compte du second ouvrier assigné dans la détection.
- Comportement inchangé sans conflit ; le reste du planning n'est pas touché.

## 4. Bouton « Nouvelle fiche » (ouvrier)

Ajout d'un bouton en haut à droite de `MobileFiches.tsx`, même style que le bouton « Demander » de `MobilePieces.tsx`, qui navigue vers le workflow existant `/mobile/fiche/nouvelle` (`MobileNouvelleFiche`). Aucun second workflow, permissions inchangées.

## 5. Emails automatiques

Vérifié : deux crons existent (`send-entretien-reminders-daily` à 7 h, `process-email-reminders-5min`), plus le monitoring sécurité. Le flux `send-entretien-reminders → send-email → Resend` est en place, avec idempotence par `reminder_sent_for_date` et logs dans `email_logs`.

À vérifier/corriger uniquement si défaillant :
- cohérence des en-têtes d'authentification des crons avec `verify_jwt` des fonctions ;
- présence effective du secret utilisé par le cron entretiens ;
- enregistrement des erreurs d'envoi (`email_logs` / `scheduled_email_reminders.error_message`) ;
- pas de double envoi.

Aucune infrastructure PGMQ/cron nouvelle.

## 6. Audit du dépôt

Passage sur migrations, Edge Functions, RLS, types Supabase, dépendances, appels frontend/backend, références obsolètes, code mort, secrets attendus, écarts local/Supabase. Correction uniquement des problèmes réels ; le reste est listé en fin de passage.

## 7. Vérification anti-régression

Contrôle ciblé des zones déjà validées (fiches, planning, commandes, admin, mobile) après les corrections. Modification seulement en cas de régression avérée.

## 8. Tests finaux (préparation)

Ajout d'un document de tests (`docs/tests/plan-de-tests.md`) couvrant auth, utilisateurs, rôles, isolation `company_id`, planning, fiches, commandes, notifications, emails, conflits, permissions, dashboard, mobile, responsive. Aucun test exécuté maintenant.

## 9. Capacitor / APK

Aucun build APK. Vérification que les modifications n'introduisent pas de dépendance incompatible et que `capacitor.config.ts` reste valable.

## Détails techniques

- Migration ajoutée : `supabase/migrations/<timestamp>_bureau_received_at.sql` (colonne + index + trigger + backfill + pas de modification des GRANT/RLS existants).
- Fichiers principaux visés : `src/components/dashboard/bureau/BureauDashboard.tsx`, `BureauFicheTable.tsx`, `types.ts`, `src/lib/overlapUtils.ts`, `src/components/planning/CreateTaskDialog.tsx`, `TaskDetailDialog.tsx`, `src/components/mobile/MobileTaskNotifications.tsx`, `src/pages/mobile/MobileFiches.tsx`.
- `src/integrations/supabase/types.ts` régénéré uniquement si la migration est appliquée ; sinon accès typé prudemment pour ne pas casser le build local.
- Livrable final : liste des fichiers modifiés, migrations créées, problèmes corrigés / volontairement non corrigés, puis `npm run build` et `npm run dev`.
