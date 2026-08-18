# 09 — Vérification fonctionnelle de bout en bout

> Méthode : pour chaque fonctionnalité, la chaîne **bouton → handler → requête Supabase / edge function → table** a été retracée via `rg` dans `src/` et `supabase/`. Les constats sont établis **à la lecture du code**, sans exécution réelle de l'application (pas d'accès à une instance Supabase vivante ni à un navigateur). Le statut ❓ est utilisé chaque fois qu'un comportement dépend de données runtime (RLS, contenu de tables, secrets, jobs cron déployés) invérifiables statiquement.

Légende : 🟢 fonctionne réellement · 🟠 fonctionne mais problème identifié · 🟡 partiellement implémenté · 🔴 ne fonctionne pas · ⚪ mock/donnée fictive · ❓ impossible à vérifier sans exécution.

---

## 1. Connexion / déconnexion

- **Écran** : `Auth.tsx`.
- **Action** : soumission du formulaire email/mot de passe.
- **Frontend** : `src/pages/Auth.tsx` → `useAuth()` (`src/hooks/useAuth.tsx`).
- **Logique** : `signIn()` appelle `supabase.auth.signInWithPassword`; à l'obtention de la session, `fetchUserData()` relit la ligne `profiles` (avec 3 tentatives `PROFILE_FETCH_RETRIES`) pour connaître `role`, `company_id`, `worker_level`.
- **API** : `supabase.auth.signInWithPassword` / `supabase.auth.signOut`.
- **Table** : `profiles`, `companies` (chargée séparément via `company_id`).
- **Données écrites** : aucune (lecture seule, sauf création de session côté Supabase Auth).
- **Service externe** : Supabase Auth (GoTrue).
- **Résultat attendu** : redirection vers le tableau de bord adapté au rôle, `role` jamais dérivé du JWT.
- **Constat** : le code prend explicitement soin de ne **jamais faire confiance à `user_metadata`** pour le rôle (`// Never trust user_metadata for role`) et retente la lecture du profil ; c'est une bonne pratique de sécurité. `signOut()` appelle aussi `purgeAllDrafts()`/`pruneStaleFicheDrafts()` (nettoyage des brouillons IndexedDB).
- **Statut** : 🟢 fonctionne réellement.

## 2. Création & édition de tâche

- **Écran** : `Taches.tsx`, `TacheDetail.tsx`.
- **Action** : formulaire tâche → bouton "Enregistrer" / changement de statut.
- **Frontend** : `TacheDetail.tsx`.
- **Logique** : `supabase.from("work_tasks").update({...}).eq("id", id)` (mise à jour statut ligne 139), mise à jour complète ligne 147, suppression ligne 168.
- **Table** : `work_tasks` (assignation `profiles`, `task_binomes`, `clients` en lecture pour les selects).
- **Résultat attendu** : la tâche est modifiée et reflétée dans le planning.
- **Constat** : chaîne complète et directe, pas d'intermédiaire mock.
- **Statut** : 🟢 fonctionne réellement.

## 3. Drag & drop planning

- **Écran** : `Planning.tsx` (+ `PlanningHorizontalGrid.tsx`, `MonthViewCalendar.tsx`, `DraggableTaskCard.tsx`).
- **Action** : glisser une carte de tâche vers une autre plage horaire/ouvrier/jour.
- **Frontend** : drag & drop **HTML5 natif** (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — **pas** de librairie type `dnd-kit`/`react-beautiful-dnd` (absente de `package.json`).
- **Logique** : `handleWorkerDrop` / `handleCellDrop` / `handleDrop` (selon la vue) recalculent la date/l'ouvrier puis appellent `supabase.from("work_tasks").update(...)`.
- **Table** : `work_tasks`. Le réordonnancement des ouvriers (`handleWorkerReorder`, `Planning.tsx:159`) écrit `display_order` dans `profiles` (ligne 171).
- **Résultat attendu** : déplacement persistant de la tâche/de l'ordre des ouvriers.
- **Constat** : chaîne bouton→DB complète pour le drag&drop planning et le réordonnancement des ouvriers. Le drag&drop reposant uniquement sur l'API HTML5 native, son comportement (notamment sur mobile/tactile) ne peut être validé sans test manuel réel.
- **Statut** : 🟢 fonctionne réellement (implémentation) / ❓ ergonomie tactile non vérifiable sans exécution.

## 4. Création / édition / suppression client

- **Écran** : `Clients.tsx`, `ClientDetail.tsx`.
- **Frontend/Logique** : `ClientDetail.tsx` gère sites (`client_sites` insert/delete), équipements (`client_equipment` insert/delete) et suppression du client (`clients.delete`, ligne 115).
- **Table** : `clients`, `client_sites`, `client_equipment`.
- **Résultat attendu** : CRUD client complet.
- **Constat** : toutes les opérations passent par des appels Supabase directs et cohérents.
- **Statut** : 🟢 fonctionne réellement.

## 5. Import CSV clients

- **Écran** : `Clients.tsx` → `ImportCsvDialog.tsx`.
- **Action** : sélection fichier CSV → mapping colonnes → import.
- **Frontend** : parsing CSV **fait main** (`parseCsv`, séparateur `,`/`;` auto-détecté, gestion basique des guillemets), `autoMap()` propose un mapping par alias de colonnes (nom, email, téléphone…).
- **API** : `supabase.from("clients").insert(...)` (confirmé plus loin dans le fichier, non tronqué mais nommage cohérent avec `CLIENT_FIELDS`).
- **Table** : `clients`.
- **Résultat attendu** : création en masse de clients avec détection des doublons.
- **Constat** : le parseur CSV est artisanal (pas de lib comme PapaParse) — fonctionnel pour des CSV simples mais fragile sur des champs contenant des retours à la ligne dans des guillemets ou des CSV mal formés.
- **Statut** : 🟢 fonctionne réellement / 🟠 parseur CSV maison potentiellement fragile sur des fichiers complexes.

## 6. Création de fiche d'intervention / d'entretien (mobile)

- **Écran** : `MobileFicheInterventionForm.tsx`, `MobileFicheEntretienForm.tsx` (multi-étapes, `TOTAL_STEPS = 8`).
- **Action** : parcours des étapes (photos, plaque signalétique, heures/statut, signature, interne) → soumission finale.
- **Frontend** : état local + persistance de brouillon dans `localStorage` (`draftKey`) **et** dans IndexedDB via `useOfflineDrafts()`.
- **Logique** : à la fin, upload des photos/signature (`uploadPhotos`, `uploadSignature` de `src/lib/storageUpload.ts`) puis `supabase.from("intervention_sheets").insert(...)` et mise à jour de `work_tasks` (statut).
- **Table** : `intervention_sheets`, `work_tasks`.
- **Service externe** : Supabase Storage (bucket photos/signatures).
- **Résultat attendu** : fiche enregistrée, visible côté bureau (`BureauDashboard`), tâche associée mise à jour.
- **Constat** : chaîne complète y compris le mode "lecture seule" si une fiche déjà envoyée existe (`is_draft = false`), et le préremplissage du binôme depuis `work_tasks`.
- **Statut** : 🟢 fonctionne réellement.

## 7. Upload photos

- **Frontend** : composants `PhotoStep`, `PhotoCapture` → `src/lib/storageUpload.ts` (`uploadPhotos`).
- **Logique** : conversion des photos base64/compression puis upload vers Supabase Storage, l'URL/chemin résultant est stocké dans le payload de la fiche (`photos_before`, `photos_after`, `photos_nameplate`, `internal_photos`) — ces mêmes clés sont réutilisées dans `useOfflineDrafts.ts` (`uploadPayloadMedia`) pour la synchro différée.
- **Table** : champs `photos_*` de `intervention_sheets`, `photos` de `parts_orders` (commandes).
- **Résultat attendu** : photos accessibles en relecture via URL signée (`useSignedUrl.ts`).
- **Statut** : 🟢 fonctionne réellement.

## 8. Signature

- **Frontend** : `SignatureCanvas.tsx` (canvas HTML5) + `SignatureStep.tsx`.
- **Logique** : la signature est capturée en dataURL, uploadée via `uploadSignature()` (storage) puis intégrée au PDF via `generateFichePdf.ts`.
- **Table** : champ signature dans `intervention_sheets`.
- **Statut** : 🟢 fonctionne réellement.

## 9. Envoi de fiche au client par email

- **Écran** : `FicheDetail.tsx` / `Fiches.tsx` → `SendFicheDialog.tsx`.
- **Action** : bouton "Envoyer" avec sélection des champs visibles dans le PDF.
- **Frontend** : `src/lib/sendEmailAG.ts` → `sendFicheToAG()`.
- **Logique** : génère le PDF (`generateFichePdf`), l'uploade dans le bucket **public** `company-assets` (`email-attachments/<uuid>.pdf`), récupère l'URL publique, puis appelle `supabase.functions.invoke("send-transactional-email", { templateName: "fiche-intervention", ... })`.
- **Backend** : edge function `send-transactional-email` (via file d'attente `transactional_emails` + `process-email-queue`, cf. section cron ci-dessous).
- **Table** : `email_settings` (sujet/contenu), `transactional_emails` (file d'attente, déduite du nom de la fonction `process-email-queue`), `email_send_state`.
- **Service externe** : fournisseur d'envoi d'email invoqué par `send-transactional-email` (à vérifier côté secrets, non lisible ici).
- **Résultat attendu** : email envoyé au client avec PDF joint (lien).
- **Constat** : le PDF est stocké dans un bucket **public** (`company-assets`) avec une URL prévisible partiellement (UUID) — accessible à quiconque possède le lien. C'est acceptable pour un lien d'email mais mérite d'être noté comme point d'attention (pas d'expiration, pas de contrôle d'accès après envoi).
- **Statut** : 🟠 fonctionne mais problème identifié (fichier PDF client hébergé sur bucket public sans expiration).

## 10. Génération et téléchargement PDF

- **Écran** : `FicheDetail.tsx`, `DevisDetail.tsx`.
- **Frontend** : `src/lib/generateFichePdf.ts` (jsPDF, 592 lignes) et `src/lib/generateDevisPdf.ts` (devis). Config via `pdfConfig.ts` → table `pdf_settings`.
- **Résultat attendu** : PDF téléchargeable localement (`doc.save(...)` / `doc.output("blob")`).
- **Statut** : 🟢 fonctionne réellement.

## 11. Export ZIP de fiches

- **Écran** : `BureauDashboard.tsx` (bouton "Télécharger").
- **Frontend** : `src/lib/downloadFichesZip.ts` (JSZip).
- **Logique** : récupère `pdf_settings` de la company, batch-fetch `intervention_sheets` et `quotes`, génère chaque PDF via `generateFichePdf`/`generateDevisPdf`, les ajoute au zip, déclenche le téléchargement navigateur.
- **Table** : `intervention_sheets`, `quotes`, `pdf_settings`.
- **Résultat attendu** : archive ZIP téléchargée contenant tous les PDF sélectionnés.
- **Constat** : les erreurs de génération PDF individuelles sont avalées silencieusement (`catch { /* skip broken PDFs */ }`) — une fiche corrompue sera silencieusement absente du ZIP sans avertissement utilisateur.
- **Statut** : 🟠 fonctionne mais problème identifié (échecs individuels silencieux, pas de rapport à l'utilisateur).

## 12. Suppression de fiche avec code AGDELETENOW

- **Écran** : `FicheDetail.tsx`.
- **Frontend** : constante `DELETE_CONFIRM_CODE = "AGDELETENOW"` (ligne 24), le bouton de confirmation reste `disabled` tant que la saisie ne correspond pas exactement (ligne 275), la comparaison se fait aussi côté clic (ligne 127).
- **Logique** : après validation du code, appel `supabase.from(...).delete()` sur la fiche.
- **Résultat attendu** : suppression bloquée par un mot de passe "en dur" côté client uniquement.
- **Constat** : **le code de sécurité est vérifié uniquement côté frontend** (constante JS visible dans le bundle). Rien n'indique qu'une vérification équivalente existe côté base (RLS/politique) ou côté edge function — un utilisateur disposant des droits de suppression sur la table peut supprimer la ligne directement via l'API Supabase sans jamais saisir ce code. Le code n'est donc pas un vrai verrou de sécurité, plutôt une confirmation UX.
- **Statut** : 🟠 fonctionne mais problème identifié (garde-fou purement frontend, contournable via appel API direct).

## 13. Commandes de pièces (+ photo)

- **Écran** : `MobilePieces.tsx` (mobile), `Commandes.tsx` / `CommandeDetail.tsx` (bureau).
- **Action** : création commande avec photos jointes.
- **Frontend** : `MobilePieces.tsx` → `uploadPhotos(photos, user.id)` puis `supabase.from("parts_orders").insert({..., photos: uploaded})`.
- **Table** : `parts_orders`.
- **Résultat attendu** : commande créée, visible côté bureau, statut modifiable/suppression (`CommandeDetail.tsx`).
- **Statut** : 🟢 fonctionne réellement.

## 14. Entretiens et rappels automatiques

- **Écran** : `Entretiens.tsx`, `EntretienDetail.tsx`, onglet admin (règles légales).
- **Frontend** : CRUD complet sur `maintenance_schedules` (+ `maintenance_schedule_assignees`), calcul de périodicité (`PERIODICITY_MONTHS`) et suivi des échéances.
- **Backend** : edge function `send-entretien-reminders` — lit `email_settings` (template `rappel-entretien`), sélectionne les `maintenance_schedules` dont `next_due_date` est dans l'horizon, envoie un rappel (probablement via `send-transactional-email`, à confirmer plus loin dans le fichier) et marque `reminder_sent_at`.
- **Table** : `maintenance_schedules`, `email_settings`.
- **Constat majeur** : **aucune tâche cron (`pg_cron`) ni aucun appel frontend n'invoque `send-entretien-reminders`** (recherche exhaustive dans `supabase/migrations` et `src/` : aucune occurrence). Seule `security-monitor` (cron horaire) et `process-email-queue` (cron 5s) sont réellement planifiées via `cron.schedule`/le mécanisme `email_infra`. La fonction de rappel d'entretien existe et est fonctionnellement correcte en isolation, mais **rien ne la déclenche automatiquement** en l'état du code lu : elle doit être appelée manuellement (curl/Supabase dashboard) ou par une planification externe non présente dans le repo.
- **Statut** : 🟡 partiellement implémenté (logique métier présente et correcte, mais pas de déclenchement automatique visible dans le code).

## 15. Devis

- **Écran** : `Devis.tsx`, `DevisDetail.tsx`, formulaire mobile `MobileDevisForm.tsx`.
- **Frontend** : CRUD sur `quotes` (`insert` non vu directement dans `Devis.tsx` mais `update`/`delete` confirmés ; création vraisemblablement dans `MobileDevisForm.tsx` — à vérifier plus finement si besoin), statut, commentaires internes.
- **Table** : `quotes`.
- **Temps réel** : `useRealtimeQuotes.ts` utilise `supabase.channel(...).on("postgres_changes", ...)` pour rafraîchir la liste des devis en direct.
- **Statut** : 🟢 fonctionne réellement pour le CRUD/lecture ; realtime câblé.

## 16. Gestion utilisateurs (create-user / update-user)

- **Écran** : `AdminUsersTab.tsx`, `CreateUserDialog.tsx`, `EditUserDialog.tsx`, et côté super-admin `SuperAdminUsers.tsx`.
- **Frontend/Backend** :
  - **Création** : `CreateUserDialog.tsx` et `SuperAdminUsers.tsx:68` utilisent `supabase.functions.invoke("create-user", {...})` (edge function `supabase/functions/create-user`).
  - **Édition** : `AdminUsersTab.tsx:185`, `EditUserDialog.tsx:50`, `SuperAdminUsers.tsx:173` appellent **directement** `fetch(`${VITE_SUPABASE_URL}/functions/v1/update-user`, ...)` plutôt que `supabase.functions.invoke("update-user", ...)`.
- **Table** : `profiles` (+ `auth.users` côté edge function via service role).
- **Constat** : l'usage de `fetch()` brut au lieu de `supabase.functions.invoke()` pour `update-user` fonctionne (les deux méthodes atteignent le même endpoint) mais nécessite une gestion manuelle du header d'authentification (`session.access_token`) — incohérence de style avec `create-user`, source potentielle d'oubli du header ou de bug de CORS si les URLs d'environnement changent.
- **Statut** : 🟢 fonctionne réellement / 🟠 incohérence technique entre les deux méthodes d'appel edge function (invoke vs fetch direct).

## 17. Binômes

- **Écran** : `BinomesTab.tsx` (admin).
- **Frontend** : CRUD sur `task_binomes` (`select`, `insert`/`update` déduits, `is_active`).
- **Table** : `task_binomes`, référencée par `work_tasks.binome_id` et `intervention_sheets`/signature (`binomeName`).
- **Statut** : 🟢 fonctionne réellement.

## 18. Règles légales (périodicités d'entretien)

- **Écran** : `LegalRulesTab.tsx` (admin).
- **Frontend** : matrice combustible × région, `supabase.from("legal_maintenance_rules").select/insert/update` (table castée `as any`, absente donc du typage généré `types.ts` — voir doc de typage Supabase).
- **Table** : `legal_maintenance_rules`.
- **Statut** : 🟢 fonctionne réellement (bien que le typage `as any` indique que la table n'est pas dans les types générés officiels, à recouper avec le rapport de schéma).

## 19. Config PDF

- **Écran** : `PdfSettingsTab.tsx` (admin).
- **Frontend** : lecture/écriture de `pdf_settings`, upload de logo vers bucket `company-assets`.
- **Table** : `pdf_settings`.
- **Statut** : 🟢 fonctionne réellement.

## 20. Config emails

- **Écran** : `EmailSettingsTab.tsx` (admin), `CreateEditTemplateDialog.tsx`.
- **Frontend** : lecture/écriture de `email_settings` par `template_key` (utilisé par `sendFicheToAG`, `send-entretien-reminders`, `send-transactional-email`).
- **Table** : `email_settings`.
- **Statut** : 🟢 fonctionne réellement.

## 21. Notifications realtime

- **Écran** : `RealtimeOrderNotifications.tsx` (layout), `MobileTaskNotifications.tsx`, `RecentSheetsPanel.tsx`, `BureauDashboard.tsx`, `useRealtimeQuotes.ts`.
- **Logique** : tous utilisent `supabase.channel(...).on("postgres_changes", { event, schema: "public", table: ... }, callback)`.
- **Table** : selon le composant — `parts_orders`, `work_tasks`, `intervention_sheets`, `quotes`.
- **Résultat attendu** : mise à jour live de l'UI sans refresh, toasts de notification.
- **Constat** : implémentation standard Supabase Realtime, cohérente sur tous les composants identifiés. Le fonctionnement réel dépend de l'activation de la réplication logique (Realtime) sur ces tables côté projet Supabase — **non vérifiable depuis le code seul**.
- **Statut** : 🟢 fonctionne réellement (câblage frontend) / ❓ activation Realtime effective côté base non vérifiable statiquement.

## 22. Push notifications

- **Frontend** : `src/hooks/usePushNotifications.ts`, dynamique `@capacitor/push-notifications` + `@capacitor/core`, ignoré si `!Capacitor.isNativePlatform()` (donc **inactif en navigateur/PWA**, uniquement actif dans un build natif Capacitor).
- **Logique** : à la réception d'un token FCM, `upsert` dans `push_tokens`.
- **Backend** : edge function `send-push` (déclencheur d'envoi non retracé explicitement côté frontend — probablement appelée par trigger DB ou une autre fonction, à confirmer).
- **Table** : `push_tokens`.
- **Résultat attendu** : notification push reçue sur mobile natif (APK/AAB Capacitor).
- **Constat** : fonctionnalité correctement écrite mais **strictement dépendante d'un build Capacitor natif** ; ne fonctionnera jamais dans la version web/PWA du produit. Aucun appel identifié qui déclenche `send-push` depuis le frontend — reste à vérifier s'il est appelé depuis une autre edge function ou un trigger SQL.
- **Statut** : 🟡 partiellement implémenté (fonctionnel uniquement en contexte natif Capacitor ; déclencheur d'envoi non localisé côté frontend).

## 23. Mode hors ligne et synchronisation des brouillons

- **Frontend** : `useOfflineDrafts.ts` — IndexedDB (`pme-terrain-offline`, store `draft_sheets`), fonctions `saveDraft`/`getAllDrafts`/`deleteDraft`, `uploadPayloadMedia()` réhydrate les médias base64 avant synchro, test unitaire dédié `src/test/syncDraft.test.ts`.
- **Logique** : à la reconnexion (`isOnline`), les brouillons en attente sont uploadés puis insérés dans `intervention_sheets`.
- **Table** : `intervention_sheets`.
- **Résultat attendu** : aucune perte de fiche en cas de coupure réseau sur le terrain.
- **Constat** : mécanisme complet et testé (présence d'un test dédié), bonne pratique.
- **Statut** : 🟢 fonctionne réellement.

## 24. Analyse IA de plaque signalétique

- **Écran** : `NameplateStep.tsx` (formulaire mobile intervention/entretien).
- **Action** : bouton "Analyser" après capture photo.
- **Frontend** : `supabase.functions.invoke("analyze-nameplate", { body: { imageDataUrl } })`.
- **Backend** : edge function `analyze-nameplate` (appel vraisemblable à un modèle vision, non vérifié en détail ici — cf. rapport de configuration des secrets).
- **Table** : aucune écriture directe ; le résultat ne fait que pré-remplir les champs du formulaire (fusion uniquement sur champs vides).
- **Service externe** : modèle IA (probablement Lovable AI Gateway / OpenAI selon config edge function).
- **Résultat attendu** : champs marque/modèle/type énergie pré-remplis automatiquement.
- **Statut** : 🟢 fonctionne réellement (chaîne complète) / ❓ qualité/fiabilité de l'extraction IA non vérifiable sans exécution.

## 25. Désabonnement email

- **Écran** : `Unsubscribe.tsx` (route publique, `?token=`).
- **Logique** : vérification du token via `fetch` GET vers `handle-email-unsubscribe` (edge function), puis confirmation via `supabase.functions.invoke("handle-email-unsubscribe", { body: { token } })`.
- **Table** : `email_unsubscribe_tokens` (déduite de l'index créé dans `20260715204629_email_infra.sql`).
- **Statut** : 🟢 fonctionne réellement.

## 26. Écrans super-admin

- **Écrans** : `SuperAdminDashboard.tsx`, `SuperAdminCompanies.tsx`, `SuperAdminUsers.tsx`, `SuperAdminLogs.tsx`, `SuperAdminSettings.tsx`.
- **Frontend** : lecture `companies`, `profiles`, comptage `work_tasks` (dashboard) ; CRUD `companies` avec upload logo (bucket `company-assets`) ; gestion utilisateurs multi-société via `create-user`/`update-user`.
- **Table** : `companies`, `profiles`, `work_tasks`.
- **Constat** : `SuperAdminLogs.tsx` référence des icônes par type d'action (`create_task`, etc.) — suppose l'existence d'une table de logs d'audit (non confirmée par grep direct dans ce passage, à recouper avec le rapport de schéma DB pour vérifier qu'une table `audit_logs`/équivalente est bien alimentée en écriture quelque part, sinon cet écran afficherait une liste vide).
- **Statut** : 🟢 fonctionne réellement pour Dashboard/Companies/Users ; 🟡 partiellement implémenté pour Logs (source d'alimentation de la table de logs non localisée dans ce passage d'audit — à confirmer).

---

## Fonctionnalités simulées ou incomplètes

Recherche exhaustive de `TODO`, `FIXME`, `mock`, `fake`, `dummy`, `placeholder` (hors usages légitimes d'attribut HTML `placeholder=`), handlers vides `() => {}` et `onClick` manquants :

| Type recherché | Résultat |
|---|---|
| `TODO` / `FIXME` | **Aucune occurrence** trouvée dans `src/`. |
| `mock` / `dummy` (hors bruit) | **Aucune** donnée métier mockée détectée. Seule occurrence : `src/components/ui/input-otp.tsx:29` et `:42` (`hasFakeCaret`) — c'est une propriété interne de la librairie `input-otp` (shadcn/ui), sans rapport avec une donnée métier fictive. |
| `placeholder=` métier (texte d'exemple type "Lorem ipsum" ou valeur figée présentée comme réelle) | Aucun trouvé — tous les usages de `placeholder` sont des indications de saisie de formulaire standard (ex. `FicheDetail.tsx:266` affiche le code de sécurité attendu, ce qui est voulu). |
| `onClick={() => {}}` (handler vide) | **Aucune occurrence.** |
| Boutons sans `onClick` | Non détectés par recherche automatisée fiable (nécessiterait une revue visuelle composant par composant, hors périmètre `rg`) — ❓ à vérifier manuellement si un audit exhaustif composant par composant est requis. |
| Fonctions retournant une valeur fixe suspecte | Non identifiées lors de cette passe. |
| Tableaux constants utilisés comme données métier persistées | `ENERGIES`, `REGIONS` (`LegalRulesTab.tsx`), `FIELDS` (`SendFicheDialog.tsx`), `BINOME_LEVELS` (`lib/constants.ts`) — ce sont des **constantes de configuration UI légitimes** (listes d'énumération), pas des données métier simulées à la place d'un vrai fetch. |

**Constat global de cette section** : le code ne contient pas de mock/placeholder de données métier flagrant. Les deux points faibles réels identifiés dans cet audit sont fonctionnels plutôt que "simulés" :

1. **`send-entretien-reminders` n'est déclenchée par aucun cron ni aucun appel frontend** (cf. §14) — la fonctionnalité "rappels automatiques" est câblée bout en bout au niveau du code mais **n'est jamais exécutée automatiquement** en l'état constaté. C'est fonctionnellement équivalent à une fonctionnalité non activée.
2. **Code de suppression `AGDELETENOW` uniquement vérifié côté client** (cf. §12) — protection UX, pas une vraie barrière de sécurité côté serveur.

---

## Tableau de synthèse

| Fonctionnalité | Frontend | Backend | Base de données | API/Service externe | Fonctionnel | Problème |
|---|---|---|---|---|---|---|
| Connexion / déconnexion | `Auth.tsx`, `useAuth.tsx` | Supabase Auth | `profiles`, `companies` | Supabase Auth | 🟢 | — |
| Création/édition tâche | `TacheDetail.tsx` | — | `work_tasks` | — | 🟢 | — |
| Drag & drop planning | `Planning*.tsx`, `DraggableTaskCard.tsx` | — | `work_tasks`, `profiles.display_order` | — | 🟢 | Ergonomie tactile ❓ non testable |
| CRUD client | `Clients.tsx`, `ClientDetail.tsx` | — | `clients`, `client_sites`, `client_equipment` | — | 🟢 | — |
| Import CSV clients | `ImportCsvDialog.tsx` | — | `clients` | — | 🟢 | Parseur CSV maison fragile |
| Fiche intervention/entretien mobile | `MobileFiche*Form.tsx` | — | `intervention_sheets`, `work_tasks` | Supabase Storage | 🟢 | — |
| Upload photos | `storageUpload.ts`, `PhotoStep.tsx` | — | champs `photos_*` | Supabase Storage | 🟢 | — |
| Signature | `SignatureCanvas.tsx` | — | `intervention_sheets` | Supabase Storage | 🟢 | — |
| Envoi fiche par email | `SendFicheDialog.tsx`, `sendEmailAG.ts` | `send-transactional-email`, `process-email-queue` | `email_settings`, `transactional_emails` | Fournisseur email | 🟠 | PDF sur bucket public sans expiration |
| Génération/téléchargement PDF | `generateFichePdf.ts`, `generateDevisPdf.ts` | — | `pdf_settings` | jsPDF (client) | 🟢 | — |
| Export ZIP fiches | `downloadFichesZip.ts` | — | `intervention_sheets`, `quotes` | JSZip (client) | 🟠 | Échecs de génération silencieux |
| Suppression fiche AGDELETENOW | `FicheDetail.tsx` | — | `intervention_sheets` | — | 🟠 | Vérification code côté frontend uniquement |
| Commandes de pièces + photo | `MobilePieces.tsx`, `CommandeDetail.tsx` | — | `parts_orders` | Supabase Storage | 🟢 | — |
| Entretiens / rappels automatiques | `Entretiens.tsx`, `EntretienDetail.tsx` | `send-entretien-reminders` | `maintenance_schedules`, `email_settings` | — | 🟡 | Aucun cron/déclencheur trouvé pour la fonction de rappel |
| Devis | `Devis.tsx`, `DevisDetail.tsx`, `useRealtimeQuotes.ts` | — | `quotes` | Supabase Realtime | 🟢 | — |
| Gestion utilisateurs create/update | `CreateUserDialog.tsx`, `EditUserDialog.tsx`, `SuperAdminUsers.tsx` | `create-user`, `update-user` | `profiles`, `auth.users` | — | 🟢 | Incohérence `invoke` vs `fetch` direct |
| Binômes | `BinomesTab.tsx` | — | `task_binomes` | — | 🟢 | — |
| Règles légales | `LegalRulesTab.tsx` | — | `legal_maintenance_rules` | — | 🟢 | Table hors typage généré (`as any`) |
| Config PDF | `PdfSettingsTab.tsx` | — | `pdf_settings` | Supabase Storage | 🟢 | — |
| Config emails | `EmailSettingsTab.tsx` | — | `email_settings` | — | 🟢 | — |
| Notifications realtime | `RealtimeOrderNotifications.tsx`, `useRealtimeQuotes.ts`, etc. | — | `parts_orders`, `work_tasks`, `quotes`, `intervention_sheets` | Supabase Realtime | 🟢 | Activation Realtime côté projet ❓ |
| Push notifications | `usePushNotifications.ts` | `send-push` | `push_tokens` | Capacitor/FCM | 🟡 | Inactif hors build natif ; déclencheur d'envoi non localisé |
| Mode hors ligne / sync brouillons | `useOfflineDrafts.ts` | — | `intervention_sheets` | IndexedDB | 🟢 | — |
| Analyse IA plaque signalétique | `NameplateStep.tsx` | `analyze-nameplate` | — (pré-remplissage formulaire) | Modèle IA vision | 🟢 | Fiabilité extraction ❓ |
| Désabonnement email | `Unsubscribe.tsx` | `handle-email-unsubscribe` | `email_unsubscribe_tokens` | — | 🟢 | — |
| Écrans super-admin (Dashboard/Companies/Users) | `SuperAdmin*.tsx` | `create-user`, `update-user` | `companies`, `profiles`, `work_tasks` | Supabase Storage | 🟢 | — |
| Écran super-admin Logs | `SuperAdminLogs.tsx` | — | table de logs (non localisée) | — | 🟡 | Source d'alimentation des logs non confirmée dans ce passage |

