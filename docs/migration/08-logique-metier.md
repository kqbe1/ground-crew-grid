# 08 — Logique métier

> Documentation factuelle des règles métier du SaaS de planning/interventions chauffage.
> Pour chaque règle : **UI → logique frontend → API (supabase-js / edge function) → backend → base de données**.
> ⚠️ Une règle qui ne descend jamais jusqu'à la base de données (contrainte SQL, trigger, RLS) est **contournable** par un appel API direct (Postman, un autre client, un bug frontend). C'est signalé explicitement.

---

## 1. Planning & tâches

### 1.1 Création d'une tâche
- **UI** : `src/components/planning/CreateTaskDialog.tsx` — dialogue « Créer une tâche », déclenché depuis un clic sur un créneau du planning (`WeekViewGrid`, `PlanningHorizontalGrid`, `MonthViewCalendar`).
- **Frontend** :
  - Champs obligatoires : titre (validation manuelle JS, `if (!title.trim())`, **pas de contrainte NOT NULL bypassable** puisque `title TEXT NOT NULL` existe en base — donc doublée, cohérente).
  - `computeEndTime` / `computeDurationMinutes` (`src/lib/timeRange.ts`) convertissent heure de début + heure de fin ↔ `duration_minutes`. Règle : si l'heure de fin est ≤ heure de début, durée forcée à un minimum de **15 minutes**.
  - Brouillon de saisie persistant en `sessionStorage` (`create_task_draft_v1`, voir `src/lib/draftStorage.ts`) pour restaurer le formulaire si le dialogue est refermé par erreur — **purement frontend, aucune trace serveur**.
- **API** : insertion via `supabase.from("work_tasks").insert(...)`, puis insertion des ouvriers additionnels dans `work_task_assignees` (binôme / plusieurs ouvriers sur une même tâche).
- **Backend / DB** :
  - RLS INSERT sur `work_tasks` : réservé aux rôles admin/bureau/ouvrier suivant policies (`is_admin_or_secretariat()`, etc.) — **À VÉRIFIER** le détail exact des policies INSERT sur `work_tasks` (non retrouvées explicitement dans le grep des migrations fournies, à confirmer avant migration).
  - Trigger `update_work_tasks_updated_at` (maj automatique de `updated_at`).
  - Table `work_task_assignees` : trigger `set_company_id_work_task_assignees` (BEFORE INSERT) + RLS `company_select_wta` / `company_insert_wta` / `company_delete_wta` (scoping multi-tenant par `company_id`).

### 1.2 Détection de chevauchement (overlap) — **règle des 15 minutes**
- **Fichier central** : `src/lib/overlapUtils.ts`.
  - `findOverlaps(workerId, date, startTime, durationMinutes, allTasks, excludeTaskId?)` : calcule les intersections de créneaux horaires (`newStart < tEnd && newEnd > tStart`) pour un même ouvrier (`assigned_to`) à une même date.
  - `getOverlappingTaskIds(tasks)` : marque en O(n²) toutes les tâches en conflit pour affichage (bordure rouge + icône ⚠️ sur `DraggableTaskCard`).
  - Le pas de gestion visuelle est de **15 minutes** (`STEP = 15` dans `DraggableTaskCard.tsx`, arrondi lors du redimensionnement).
- **Utilisé dans** : `CreateTaskDialog.tsx` (avertissement mais **création possible quand même** — bouton "Créer malgré le chevauchement"), `PlanningHorizontalGrid.tsx` (`handleCellDrop`, avertissement toast lors d'un drag&drop créant un conflit), `TaskDetailDialog.tsx` (édition).
- **⚠️ Règle strictement frontend / non bloquante.** Aucune contrainte SQL (`EXCLUDE`, trigger de validation) n'empêche deux tâches qui se chevauchent pour un même ouvrier d'être enregistrées. Elle est uniquement **avertissante** côté UI et **totalement contournable** via un appel API direct ou un bug d'affichage. **À corriger/reproduire explicitement côté backend lors de la migration si le chevauchement doit devenir bloquant.**

### 1.3 Drag & drop
- **Réassignation par glisser-déposer** :
  - `PlanningHorizontalGrid.tsx` (`handleCellDrop`) : dépose une tâche sur un autre ouvrier/créneau → update `assigned_to`, `start_time`, `scheduled_date` via `supabase.from("work_tasks").update(...)`. Vérifie l'overlap avant écriture mais n'empêche pas l'update en cas de conflit (juste un toast d'avertissement).
  - `MonthViewCalendar.tsx` (`handleDrop`) : déplacement d'une tâche vers un autre jour (vue mensuelle) → update `scheduled_date` uniquement.
  - `handleWorkerDrop` : réordonnancement visuel des colonnes ouvriers (préférence d'affichage), **local uniquement**, pas de colonne DB dédiée identifiée — **À VÉRIFIER**.
  - `DraggableTaskCard.tsx` : redimensionnement (resize horizontal) de la durée d'une tâche par pointeur, pas de **15 min**, avec update ciblé de `duration_minutes` uniquement.
- **Backend** : le trigger `trg_restrict_ouvrier_task_update` (voir §1.5) bloque un ouvrier connecté qui tenterait de faire ces updates (assigned_to, scheduled_date, start_time, duration_minutes) — donc le drag&drop planning n'est utilisable **effectivement que par admin/bureau**, un ouvrier verrait ses colonnes silencieusement réécrites à leur valeur d'origine par la DB (pas d'erreur visible côté client, à signaler).

### 1.4 Templates de tâches
- Table `task_templates` (trigger `update_task_templates_updated_at`). RLS restreinte par rôle (`"Role-holders can view templates"`).
- **À VÉRIFIER** : usage précis des templates non retrouvé dans les fichiers explorés (`CreateTaskDialog` ne les référence pas directement) — vérifier une page Admin séparée si elle existe.

### 1.5 Restriction des modifications par un ouvrier (trigger de sécurité serveur)
- **Backend / DB** — `20260323201501_...sql`, fonction `restrict_ouvrier_task_update()` (SECURITY DEFINER), trigger `trg_restrict_ouvrier_task_update` BEFORE UPDATE ON `work_tasks` :
  - Si l'utilisateur courant est un ouvrier (`is_ouvrier()`), les colonnes suivantes sont **réécrites de force à leur ancienne valeur** quel que soit l'UPDATE tenté : `memo_secretariat`, `assigned_to`, `second_assigned_to`, `client_id`, `client_site_id`, `equipment_id`, `created_by`, `intervention_type`, `title`, `scheduled_date`, `start_time`, `duration_minutes`, `template_id`.
  - **Cette règle est appliquée côté base de données (non contournable)** — un ouvrier ne peut modifier que le statut, les notes internes et les champs liés à sa fiche via les canaux autorisés.

### 1.6 Binômes (planning)
- Table `binomes` (ancien modèle, pourcentages `user1_percentage`/`user2_percentage` CHECK 0–100 en base) et `task_binomes` (nouveau modèle avec `code`/`kind`, utilisé par `CreateTaskDialog`).
- **UI** : sélection d'un binôme dans `CreateTaskDialog.tsx` (`binome_id` sur `work_tasks`) en complément des ouvriers assignés.
- **DB** : contrainte `CHECK` sur les pourcentages garantissant une répartition 0–100 (table historique `binomes`). **À VÉRIFIER** si `task_binomes` porte une contrainte équivalente (non trouvée dans le grep, à confirmer).

---

## 2. Fiches d'intervention & entretien

### 2.1 Routage du formulaire
- **UI** : `MobileFicheRouter.tsx` détermine le type de formulaire (`intervention` vs `entretien`) en interrogeant `work_tasks.intervention_type` et en comparant à `ENTRETIEN_SUBTYPES` (constants.ts) → route vers `MobileFicheInterventionForm` ou `MobileFicheEntretienForm`.
- **Règle purement frontend** : le choix du type de formulaire n'est pas revalidé côté serveur ; l'`intervention_type` de la tâche source fait foi.

### 2.2 Étapes du formulaire (wizard)
- `MobileFicheInterventionForm.tsx` (et son pendant entretien) implémentent un **wizard multi-étapes** (steps numérotés) : coordonnées / type / checklist fournitures / photos / heures & statut / signature / commentaire interne, via les composants `src/components/mobile/steps/*`.
- Navigation contrôlée par `StepNavigation.tsx` / `StepProgressBar.tsx`. Validation par étape **purement frontend** (ex. étape "Heures & statut" validée seulement si `statusDetails.length > 0`).
- **Aucune validation serveur par étape** : seule la validation finale (insertion en base) est vérifiée par les contraintes SQL/RLS existantes.

### 2.3 Brouillons localStorage
- **Fichiers** : `src/hooks/useFicheFormDraft.ts`, `src/lib/draftStorage.ts`, `src/lib/localFicheDrafts.ts`.
- Clé `fiche_draft:<intervention|entretien>:<taskId>`, écriture debouncée (250 ms) dans `localStorage`, incluant l'étape courante (`step`) et l'horodatage (`savedAt`).
- Purge automatique : `pruneStaleFicheDrafts()` supprime les brouillons de plus de **14 jours** (`MAX_FICHE_DRAFT_AGE_MS`) ; `purgeAllDrafts()` supprime tout à la déconnexion.
- `localFicheDrafts.ts` liste les brouillons non envoyés pour affichage dans `FichesEnRetardPanel.tsx` (panneau « fiches en retard / brouillons en cours »).
- **⚠️ Entièrement côté client, propre à l'appareil/navigateur.** Un brouillon n'est jamais visible depuis un autre poste ni sur le serveur avant l'envoi final ; en cas de changement d'appareil ou de purge du cache, le brouillon est perdu.
- Distinct du mode **hors-ligne** (`useOfflineDrafts.ts`) qui persiste une fiche **complète et prête à soumettre** dans IndexedDB (`pme-terrain-offline` / store `draft_sheets`) en cas d'absence réseau, avec synchronisation automatique au retour en ligne (`online` event, visibilitychange, polling 60 s) — upload différé des photos/signature (`uploadPayloadMedia`) puis `insert` dans `intervention_sheets` + mise à jour du statut de la tâche.

### 2.4 Verrouillage après envoi
- **Frontend** : `MobileFicheInterventionForm.tsx` vérifie l'existence d'une fiche déjà envoyée (`.select("id, is_draft").eq("is_draft", false)`) pour la tâche avant d'autoriser un nouvel envoi / afficher un état "déjà complété" (bandeau vert).
- Une fois soumise (`is_draft: false`), la fiche est marquée comme définitive côté payload d'insertion.
- **⚠️ Pas de trigger DB empêchant explicitement une modification ultérieure d'une fiche `is_draft = false`** (non trouvé dans les migrations grep — **À VÉRIFIER**). Le verrouillage est donc essentiellement **une convention frontend** (le formulaire ne propose plus l'édition), potentiellement contournable par un UPDATE direct sur `intervention_sheets` si les policies RLS UPDATE l'autorisent. Il faut vérifier les policies RLS UPDATE de `intervention_sheets` pour confirmer si un ouvrier peut ou non réécrire une fiche déjà envoyée après le fait.

### 2.5 Signature client
- **UI** : `SignatureStep.tsx` + `SignatureCanvas.tsx` (canvas HTML dessiné au doigt/souris) → export en `data:image/...;base64`.
- **Frontend** : gestion de deux cas — client présent (signature obligatoire) ou absent (`client_absent: true`, pas de signature demandée) ; champs `binome_name` / `binome_percentage` pré-remplis depuis le binôme de la tâche.
- **API** : upload de la signature en base64 vers le bucket Storage `intervention-signatures` (`uploadSignature` dans `storageUpload.ts`, retour d'une URL signée 1h) avant écriture de `signature_data` / `signed_at` dans `intervention_sheets`.
- **DB / Storage RLS** : policies sur `storage.objects` limitant l'upload dans `intervention-signatures` aux utilisateurs authentifiés (`is_admin_or_secretariat() OR is_ouvrier()`), lecture réservée aux authentifiés (plus de bucket public depuis la migration `20260323204408`).

### 2.6 Statuts multiples + notes
- Table `work_tasks.status` : enum `task_status` (`planifie`, `termine`, `a_replanifier`, `piece_a_commander`) + `sav` ajouté ultérieurement (voir `TASK_STATUS_LABELS` dans `constants.ts`, 5 valeurs alors que l'enum SQL d'origine n'en a que 4 — **À VÉRIFIER** : une migration doit avoir étendu l'enum `task_status` pour ajouter `sav`, non retrouvée explicitement dans le grep fourni ; à confirmer avant migration pour éviter une erreur d'enum bloquante).
- `mapStatusToFinal(details)` (dans `MobileFicheInterventionForm.tsx`) déduit le `final_status` de la fiche à partir de la liste `statusDetails` (plusieurs constats possibles pour une même intervention, ex. "terminé" + "pièce à commander"), stockée en JSON dans `work_status_details` et `work_status_notes` (notes libres par statut, en `jsonb` probable — **À VÉRIFIER** le type exact de colonne).
- **Frontend → DB** : à la soumission de la fiche, la tâche liée (`work_tasks.status`) est mise à jour en cohérence avec le `final_status` calculé ; en mode hors-ligne, la mise à jour du statut de la tâche est effectuée **après** la synchronisation du brouillon (donc décalée dans le temps si offline).
- **Backend** : aucune règle de cohérence statut fiche/tâche vérifiée en base (pas de trigger recalculant `work_tasks.status` depuis `intervention_sheets`) — **la cohérence est garantie uniquement par le code frontend**, un insert direct dans `intervention_sheets` sans update parallèle de `work_tasks` désynchroniserait l'affichage planning.

---

## 3. Entretiens récurrents

### 3.1 Table `maintenance_schedules`
- Colonnes clés : `periodicity` (enum `maintenance_periodicity` : mensuel/trimestriel/semestriel/annuel/bisannuel/triennal), `next_due_date` (date), `status` (`actif`/autre), `reminder_sent_at`.
- Index `idx_maintenance_next_due` sur `next_due_date` (optimisation des requêtes d'échéance).

### 3.2 Règles légales régionales
- **Fichier** : `src/lib/legalRules.ts` + table `legal_maintenance_rules` (`energy_type`, `region`, `periodicity`, par `company_id` — configurable côté Admin).
- `loadLegalPeriodicityByEnergy()` charge les règles internes et retient, par type d'énergie, la **périodicité la plus stricte** parmi toutes les règles enregistrées (`strictestPeriodicity`, ordre `mensuel < trimestriel < semestriel < annuel < bisannuel < triennal`).
- **Règle appliquée uniquement côté frontend** : le calcul de la périodicité applicable (et donc de `next_due_date` lors de la création/mise à jour d'un entretien récurrent) est fait en JS au moment de l'affichage/edition ; **aucune contrainte ou trigger SQL ne vérifie que `next_due_date` respecte la règle légale enregistrée**. Un enregistrement manuel via l'API pourrait définir une échéance non conforme à la périodicité légale sans blocage serveur.
- La région est présentée comme "un paramètre interne des règles, plus une donnée du client" (commentaire du code) — c'est-à-dire que la logique de rattachement client ↔ région n'est pas automatique/géographique mais configurée manuellement par l'admin dans `legal_maintenance_rules`.

### 3.3 Alertes et rappels automatiques
- **Edge Function** : `supabase/functions/send-entretien-reminders/index.ts` (exécutée en tâche planifiée — **À VÉRIFIER** le déclenchement exact : cron Supabase, appel manuel ou scheduler externe, non trouvé dans les fichiers explorés).
  - Requiert `SUPABASE_SERVICE_ROLE_KEY` (contourne RLS, exécution côté serveur de confiance).
  - Sélectionne les `maintenance_schedules` avec `status = 'actif'`, `reminder_sent_at IS NULL`, et `next_due_date` dans un horizon (`reminder_days_before`, configurable par entreprise dans `email_settings`, défaut ≥ 30 jours).
  - Envoie un email via la fonction `send-transactional-email` si le client a un email connu ; sinon la relance est **silencieusement ignorée** (le commentaire du code précise "notification in-app only (alertes légales)" mais aucune notification in-app de repli n'a été retrouvée dans le code exploré — **À VÉRIFIER**).
  - Marque `reminder_sent_at` après envoi réussi pour éviter les doublons (protection anti double-envoi côté edge function, pas de contrainte UNIQUE dédiée en DB).
- **Frontend** : `sendEntretienReminderToAG()` (`src/lib/sendEmailAG.ts`) permet également un envoi manuel ponctuel du rappel depuis l'UI (bureau), indépendamment du job automatique.

---

## 4. Commandes de pièces (`parts_orders`)

### 4.1 Cycle de statuts
- Enum `order_status` : `demandee` → `commandee` → `recue` → `cloturee`. Enum `order_urgency` : `normal`/`urgent`/`critique`.
- **UI ouvrier** : `MobilePieces.tsx` — création d'une demande liée obligatoirement à une tâche assignée à l'ouvrier connecté (`taskId` requis, sélection parmi ses 60 dernières tâches). `client_id` déduit automatiquement de la tâche choisie.
- **Frontend** : upload optionnel de photos (`uploadPhotos`) avant insertion ; validation obligatoire de `partName` et `taskId` (bouton désactivé sinon).
- **API** : insertion directe `supabase.from("parts_orders").insert(...)` avec `status: "demandee"` toujours forcé en frontend à la création (aucun autre statut choisissable à la création).
- **DB / RLS** : policy INSERT `"Role-holder can insert orders"` = `(is_ouvrier() AND requested_by = auth.uid()) OR is_admin_or_secretariat()` — empêche un ouvrier de créer une commande au nom d'un autre utilisateur (`requested_by` doit être lui-même), vérifié **côté base**, non contournable.
- **Progression du statut** (`demandee`→`commandee`→…) : gérée côté **bureau/admin** uniquement (page dédiée non explorée en détail dans ce lot — **À VÉRIFIER** le composant desktop de gestion des commandes) ; pas de contrainte SQL empêchant de sauter un statut (ex. passer directement de `demandee` à `cloturee`) — **règle d'ordre des statuts non garantie en base, uniquement suggérée par l'UI**.

### 4.2 Lien tâche & replanification
- Chaque commande est reliée à `work_task_id` (obligatoire côté UI ouvrier) : permet d'associer une pièce en attente à une intervention, et de retrouver le statut `piece_a_commander` sur la tâche associée (`work_tasks.status`).
- **Replanification** : lorsqu'une tâche passe en statut `piece_a_commander` / `a_replanifier`, la logique de re-création d'un nouveau créneau planning (nouvelle tâche ou report de la même tâche) est **pilotée manuellement par le bureau** via `TaskDetailDialog.tsx` (changement de `status`, `scheduled_date`, `start_time`) — pas d'automatisme détecté liant la réception d'une pièce (`recue`) à une replanification automatique de la tâche. **À VÉRIFIER** s'il existe un flux (edge function ou trigger) de replanification automatique non couvert par les fichiers explorés.

---

## 5. Devis / dossiers

- **Fichier central** : `src/lib/quotesQuery.ts`.
- Statuts (`QUOTE_STATUSES`) : uniquement `en_attente` / `cloture` (contrairement aux tâches, très peu de statuts).
- **Cache client** : `fetchQuotes()` implémente un cache mémoire (`CACHE_TTL_MS = 15 000 ms`) + déduplication des requêtes concurrentes (`inflight` promise partagée) pour éviter des appels Supabase redondants entre la page Devis et le dashboard — **optimisation purement frontend**, sans impact métier mais à reproduire pour ne pas dégrader les perfs après migration.
- Filtrage (`filterQuotes`) et export CSV (`quotesToCsv`) **entièrement côté client** après chargement de la liste complète des devis (pas de filtrage serveur / pagination).
- `useRealtimeQuotes.ts` (hook) — **À VÉRIFIER en détail** : probablement un abonnement Supabase Realtime sur la table `quotes` pour rafraîchir la liste en direct (non lu en détail dans ce lot).
- `DEVIS_CHECKLISTS` (constants.ts) : checklists techniques par type d'installation (chaudière, climatisation, VMC, salle de bain, autre) — **contenu statique frontend**, non stocké en base ; toute évolution de checklist nécessite un déploiement de code.
- Génération PDF devis : `src/lib/generateDevisPdf.ts` — **À VÉRIFIER en détail**, non exploré ligne à ligne dans ce lot mais suit vraisemblablement le même mécanisme de configuration que `generateFichePdf.ts` (voir §7).

---

## 6. Clients, sites & équipements

- Tables `clients`, `client_sites`, `client_equipment` — chacune avec trigger `update_*_updated_at`.
- **RLS clients** : accès restreint par rôle (policies `"View clients"`, `"Insert clients"`, etc., réservées à `is_admin_or_secretariat() OR is_super_admin()`); un ouvrier n'a accès qu'aux clients liés à ses tâches assignées via la fonction `get_my_clients_safe()` (SECURITY DEFINER, `20260323205328_...sql`) — **fonction backend qui filtre côté serveur les clients visibles par un ouvrier** (bonne pratique, non contournable par RLS directe car elle encapsule la logique de filtrage).
- `MobilePieces.tsx` utilise `supabase.rpc("get_my_clients_safe")` pour résoudre les noms de client sans exposer toute la table `clients` à l'ouvrier.
- Équipements (`client_equipment`) : reliés aux entretiens récurrents (`maintenance_schedules.client_equipment_id` probable — **À VÉRIFIER** le nom exact de la colonne) et utilisés pour préremplir le rappel d'entretien (nom, marque, modèle, type d'énergie) dans `sendEmailAG.ts`.
- **Recherche client** : `src/lib/searchUtils.ts` (`normalizeSearch`) — normalisation (accents, casse) pour les recherches côté client sur clients, devis, temps de travail. Recherche **entièrement frontend** sur des données déjà chargées, pas de `ilike`/full-text search côté DB détecté dans ces flux.

---

## 7. Temps de travail

- **Page** : `src/pages/TempsOuvriers.tsx`, réservée aux rôles `admin`/`bureau`/`super_admin` (redirection `<Navigate to="/" />` sinon) — **contrôle d'accès frontend uniquement pour l'affichage de la page** ; la protection réelle des données provient des RLS sur `intervention_sheets`/`profiles`/`work_tasks` (lecture large côté SELECT vraisemblablement permise aux rôles bureau — **À VÉRIFIER** les policies SELECT précises de `intervention_sheets`).
- **Calcul du temps travaillé** : `getDuration(sheet) = differenceInMinutes(departure_time, arrival_time)` (fonction `date-fns`), calculée **entièrement côté client** à partir des champs `arrival_time`/`departure_time` de `intervention_sheets` (horodatages saisis par l'ouvrier dans l'étape "Heures & statut" du formulaire terrain). Seules les fiches `is_draft = false` avec les deux horodatages renseignés sont comptabilisées.
- **Date effective d'une fiche** (`getSheetDate`) : priorité à `arrival_time` (réalité terrain), puis `scheduled_date` de la tâche, puis `created_at` de la fiche — règle métier de fallback **purement frontend**, utilisée pour le filtrage par période et les graphiques.
- Filtres (période glissante semaine/mois/trimestre/3 derniers mois/année, ouvrier, type d'intervention, recherche texte), tris et graphiques (recharts) : **tous calculés côté client** après chargement de l'ensemble des fiches non-brouillon + jointures manuelles (`work_tasks`, `profiles`, `clients`) faites en JS (pas de vue SQL agrégée) — donc **aucune limite de volume/pagination** actuellement : à surveiller en migration si le volume de fiches grossit (toutes les fiches non-brouillon de l'historique sont chargées à chaque visite de la page).
- **Export CSV** : généré en frontend (Blob), aucun passage serveur.
- **⚠️ Aucune validation métier serveur sur la cohérence `arrival_time < departure_time`** (pas de `CHECK` identifié) — un ouvrier pourrait saisir une heure de départ antérieure à l'arrivée sans blocage backend ; `getDuration()` s'en protège seulement côté affichage (`Math.max(0, ...)`).

---

## 8. Génération PDF (fiches & configuration)

- **Fichiers** : `src/lib/pdfConfig.ts`, `src/lib/generateFichePdf.ts`, `src/lib/generateDevisPdf.ts`.
- Table `pdf_settings` (par `company_id` + `document_type` : `fiche_intervention`/`fiche_entretien`/`devis`) : configuration des blocs affichés dans le PDF — `show_horaires`, `show_description`, `show_checklist`, `show_client_state`, `show_photos_before`, `show_photos_after`, `show_signature`, `show_worker_info`, `show_client_info`, `show_intervention_type`, plus habillage (`logo_url`, `primary_color`, `footer_text`, `document_title`, coordonnées société).
- **RLS** : `pdf_settings` en lecture/écriture réservée aux admins (`is_admin() OR is_super_admin()`) — configuration visible/éditable uniquement par les admins, cohérent avec la page Admin de personnalisation PDF.
- **Résolution de la config** (`fetchPdfConfig`) : cascade de fallback — configuration exacte (company + type de document) → configuration `fiche_intervention` de la société → n'importe quelle ligne de `pdf_settings` en base (`limit(1)`) si aucune des deux précédentes n'existe. **Cette cascade est un choix frontend** : en environnement multi-tenant strict, le dernier niveau de fallback (`any1`, sans filtre `company_id`) est un **risque potentiel de fuite de configuration inter-sociétés** (affichage du logo/texte d'une autre entreprise si la société courante n'a pas encore sa ligne `pdf_settings`) — à corriger ou à valider explicitement lors de la migration multi-tenant.
- **Génération** : `generateFichePdf` (jsPDF) construit le document en mémoire côté client ; `withPdfPhotos()` convertit chaque référence de photo/signature stockée (chemin Storage ou URL) en `data:` base64 (via URL signée 1h, `createSignedUrl`) pour l'incorporer dans le PDF — **traitement entièrement côté navigateur**, aucun rendu PDF serveur.
- **Envoi au client** (`sendFicheToAG` dans `sendEmailAG.ts`) : le PDF généré côté client est uploadé en `blob` vers le bucket public `company-assets` (`email-attachments/<uuid>.pdf`), puis son URL publique est transmise à l'edge function `send-transactional-email` pour être insérée dans le corps de l'email. **Le PDF final envoyé au client est donc généré et validé uniquement côté navigateur** de l'utilisateur qui déclenche l'envoi — aucune vérification serveur du contenu du PDF.

---

## 9. Utilisateurs & binômes

### 9.1 Rôles
- Enum `app_role` (`admin`, `secretariat`/`bureau`, `ouvrier`) + notion de `super_admin` ajoutée ultérieurement (fonction `is_super_admin()`, migration `20260323213826`). Table `user_roles` avec contrainte `UNIQUE(user_id, role)` (un rôle ne peut être attribué qu'une fois par utilisateur, mais **un utilisateur peut cumuler plusieurs rôles** — à vérifier si le frontend gère bien le cumul ou suppose un rôle unique, `useAuth.tsx` — **À VÉRIFIER**).
- Fonctions SQL SECURITY DEFINER : `has_role()`, `is_admin()`, `is_secretariat()`, `is_ouvrier()`, `is_admin_or_secretariat()`, `is_super_admin()` — **toute la logique d'autorisation par rôle est centralisée en base**, utilisée dans les policies RLS de la quasi-totalité des tables. C'est la barrière de sécurité réelle (le rôle affiché/vérifié côté frontend, ex. `useAuth`, n'est qu'un **confort d'affichage**, non une sécurité).

### 9.2 Niveaux ouvrier & binôme
- `worker_level` (`T0`…`T20`, `WORKER_LEVELS` généré dynamiquement dans `constants.ts`) et `binome_level` (`B0`…`B20`) : niveaux d'ancienneté/qualification affichés en badge (`useWorkerLabels.ts` probable pour le libellé combiné — **à confirmer**).
- **Trigger DB** `trg_restrict_user_profile_update` (`restrict_user_profile_update()`) : empêche un utilisateur non-admin de modifier lui-même ses colonnes `worker_level` et `is_active` sur son propre profil (réécriture forcée à `OLD` si `NOT is_admin()`). **Règle appliquée côté base, non contournable** — un ouvrier ne peut pas se promouvoir T20 ou se réactiver lui-même via un appel API direct.

### 9.3 Binômes
- Modèle historique `binomes` (paire fixe `user1_id`/`user2_id` + répartition en % avec `CHECK 0-100`) coexistant avec le modèle plus récent `task_binomes` (code/kind, sélectionné par tâche dans `CreateTaskDialog`). **Deux modèles de binôme coexistent dans le code** — à clarifier/unifier lors de la migration pour éviter la confusion entre "binôme permanent" (ancienne table) et "binôme ponctuel de tâche" (nouvelle table).
- La répartition en pourcentage (`user1_percentage`/`user2_percentage`) sert vraisemblablement au calcul de partage de prime/rémunération entre les deux ouvriers d'un binôme — **usage exact non retrouvé dans les fichiers explorés de ce lot, à documenter avec le module de paie/comptabilité s'il existe (À VÉRIFIER)**.

### 9.4 Création/désactivation d'utilisateur
- Edge functions dédiées : `create-user`, `update-user`, `cleanup-orphan-auth` (gestion des comptes `auth.users` + `profiles`, hors RLS classique car nécessitent la clé de service) — **toute création/désactivation de compte passe obligatoirement par une edge function côté serveur**, jamais par un insert direct `supabase-js` côté client (cohérent avec la nécessité de créer l'entrée `auth.users` liée). Trigger `on_auth_user_created` → `handle_new_user()` crée automatiquement la ligne `profiles` correspondante lors de la création d'un compte Auth.

---

## 10. Synthèse des règles uniquement frontend (contournables)

| Règle | Emplacement | Risque si migration sans backend équivalent |
|---|---|---|
| Détection de chevauchement de tâches (15 min) | `overlapUtils.ts`, dialogues planning | Deux tâches en conflit peuvent être enregistrées sans blocage serveur |
| Ordre du cycle de statut des commandes de pièces | UI bureau (non explorée en détail) | Un statut peut être sauté (ex. `demandee` → `cloturee`) sans erreur |
| Cohérence `arrival_time < departure_time` | `TempsOuvriers.tsx`, formulaire mobile | Temps de travail négatif possible en base, seulement corrigé à l'affichage |
| Calcul de la périodicité légale la plus stricte | `legalRules.ts` | Une échéance d'entretien non conforme à la loi peut être enregistrée sans blocage |
| Verrouillage d'une fiche après envoi (`is_draft=false`) | `MobileFicheInterventionForm.tsx` | Édition potentielle a posteriori si les policies RLS UPDATE le permettent (à vérifier) |
| Cascade de fallback de `pdf_settings` (dernière ligne "any") | `pdfConfig.ts` | Fuite de configuration (logo/texte) entre sociétés en environnement multi-tenant |
| Cohérence `work_tasks.status` ↔ `intervention_sheets.final_status` | `MobileFicheInterventionForm.tsx` | Désynchronisation possible entre statut planning et statut réel de la fiche |
| Réordonnancement visuel des colonnes ouvriers (drag) | `PlanningHorizontalGrid.tsx` | Probablement sans persistance serveur, à confirmer |
| Brouillons de fiche (localStorage) / brouillon de création de tâche (sessionStorage) | `draftStorage.ts`, `localFicheDrafts.ts` | Aucune sauvegarde serveur avant soumission finale — perte de données possible |
| Filtrage/tri/export CSV (devis, temps de travail) | `quotesQuery.ts`, `TempsOuvriers.tsx` | Pas de pagination serveur ; l'intégralité des données est chargée côté client (risque de performance à volume élevé) |

**Recommandation migration** : pour toute règle listée ci-dessus jugée critique métier (chevauchement, cycle des statuts, cohérence des horaires, verrouillage post-envoi), il est conseillé d'ajouter des contraintes/triggers/RLS explicites côté base de données afin de ne pas dépendre uniquement du bon comportement du nouveau frontend.
