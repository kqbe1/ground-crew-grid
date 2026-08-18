# 02 — Inventaire exhaustif des écrans

Source de vérité : `src/App.tsx` (routing), `src/components/layout/AppLayout.tsx`, `MobileLayout.tsx`, `SuperAdminLayout.tsx` (contrôle d'accès), `src/hooks/useAuth.tsx` (rôle chargé depuis `profiles.role`, jamais depuis `user_metadata`).

Rôles applicatifs (`profiles.role`, enum `AppRole`) : `admin`, `bureau`, `ouvrier`, `super_admin`. Un profil sans rôle (`role = null`) reste bloqué sur un écran d'attente dans `AppLayout`.

Mécanisme général de garde d'accès :
- **AppLayout** (`/`, `/planning`, `/clients`, …) : exige une session ; si `role === "ouvrier"` → redirige vers `/mobile` ; si `role === "super_admin"` → redirige vers `/super-admin` ; si `role` est `null` → écran « en attente d'attribution » ; sinon (admin/bureau) affiche la sidebar desktop ou la bottom-nav mobile (via `useIsMobile`).
- **MobileLayout** (`/mobile/*`) : exige une session (pas de contrôle strict du rôle dans le layout lui‑même — l'accès effectif est réglé par la redirection d'`AppLayout` qui n'envoie ici que les `ouvrier`; un `admin` peut aussi y accéder directement via l'URL car aucune redirection n'empêche `admin`/`bureau` d'ouvrir `/mobile`). **À VÉRIFIER** : absence de garde explicite de rôle dans `MobileLayout` — seule `AppLayout` redirige les ouvriers ; un accès direct à `/mobile` par un bureau/admin n'est pas bloqué par le code lu.
- **SuperAdminLayout** (`/super-admin/*`) : exige une session ET `role === "super_admin"`, sinon redirige vers `/`.
- Page `/auth` : si session déjà active, redirige vers `/`.

---

## 1. Écrans publics / authentification

### 1.1 Auth — `/auth`
- **Fichier** : `src/pages/Auth.tsx`
- **Rôle requis** : aucun (public) ; si déjà connecté → redirection `/`.
- **Objectif** : connexion par email/mot de passe (pas d'auto-inscription : « comptes créés par l'administrateur »).
- **Fonctionnalités** : formulaire email + mot de passe, gestion de l'état de soumission, toast d'erreur.
- **Actions** : bouton « Se connecter » (`signIn` de `useAuth`, `supabase.auth.signInWithPassword`).
- **Données créées** : aucune côté table applicative directement (l'auth Supabase gère la session) ; un événement `login` est inséré dans `activity_logs` par `useAuth` lors de l'event `SIGNED_IN`.
- **Tables Supabase** : `activity_logs` (insert, indirect via `AuthProvider`).
- **Edge functions/RPC** : aucune sur cet écran.
- **Composants** : `Card`, `Input`, `Label`, `Button` (shadcn).
- **Règles métier** : aucune inscription libre ; rôle jamais dérivé du `user_metadata`.

### 1.2 Install (PWA) — `/install`
- **Fichier** : `src/pages/Install.tsx`
- **Rôle requis** : aucun.
- **Objectif** : guider l'installation de la PWA (Android via `beforeinstallprompt`, iOS via instructions manuelles).
- **Fonctionnalités** : détection iOS, capture de l'event d'installation, bouton d'installation natif.
- **Données** : aucune table Supabase.
- **Composants** : `Card`, `Button`.

### 1.3 Unsubscribe (désabonnement email) — `/unsubscribe?token=...`
- **Fichier** : `src/pages/Unsubscribe.tsx`
- **Rôle requis** : aucun (lien public envoyé par email, protégé par token).
- **Objectif** : permettre à un destinataire d'e-mails transactionnels de se désinscrire.
- **Fonctionnalités** : vérification du token via `GET` sur l'edge function, puis confirmation via `POST`.
- **Actions** : bouton « Confirmer la désinscription ».
- **Edge functions** : `handle-email-unsubscribe` (GET pour vérifier le token, `supabase.functions.invoke` pour confirmer).
- **Tables Supabase** : aucune lecture/écriture directe depuis le front (traitement côté edge function, probablement sur `email_settings`/table de suppression — **À VÉRIFIER** dans le code de la fonction).
- **États** : loading / valid / already / success / invalid / error.

### 1.4 NotFound — `*`
- **Fichier** : `src/pages/NotFound.tsx`
- **Rôle requis** : aucun.
- **Objectif** : page 404 générique avec lien de retour à l'accueil. Log console de la route inconnue.

---

## 2. Webapp Admin / Bureau (sous `AppLayout`, path racine)

Rôles admis dans ce groupe de routes : `admin`, `bureau` (et `super_admin`/`ouvrier` sont immédiatement redirigés ailleurs par `AppLayout`, cf. section garde d'accès). Certaines pages ajoutent une restriction supplémentaire interne (`Admin.tsx`, `TempsOuvriers.tsx` réservées à `admin`/`bureau`/`super_admin`, ce qui exclut de fait `ouvrier` — déjà exclu par le layout).

### 2.1 Dashboard — `/`
- **Fichier** : `src/pages/Dashboard.tsx`
- **Rôle** : admin ou bureau (via layout). Bascule interne : `role === "bureau"` → `BureauDashboard`, sinon `AdminDashboard` (donc `admin`).
- **Objectif** : tableau de bord opérationnel (vue d'ensemble du jour/mois).

#### 2.1.a AdminDashboard (`src/components/dashboard/AdminDashboard.tsx`)
- **Fonctionnalités** : compteurs (commandes pièces par statut demandée/commandée/reçue, entretiens du mois/mois prochain, tâches en attente replanification/pièce/SAV, nombre de clients, fiches créées ce mois), listes « tâches à traiter », « commandes en cours », « entretiens à venir 30j », graphique 6 derniers mois par type d'intervention.
- **Sous-composants** : `LegalAlertsPanel`, `PartsReceivedPanel`, `RecentSheetsPanel`.
- **Tables Supabase** : `parts_orders`, `maintenance_schedules`, `work_tasks`, `clients`, `intervention_sheets`.
- **Actions** : navigation vers les listes détaillées ; pas de création/suppression sur cet écran.

#### 2.1.b BureauDashboard (`src/components/dashboard/bureau/BureauDashboard.tsx`)
- **Objectif** : vue métier « secrétariat » orientée traitement des fiches d'intervention et commandes de pièces reçues.
- **Sous-composants** : `BureauDossierAccordion`, `BureauFicheTable`, `BureauFilterBar`, `BureauFilterCards`, `BureauReceivedBanner`.
- **Tables Supabase** : `profiles`, `intervention_sheets`, `parts_orders`.
- **Fonctionnalités** : filtres par statut/ouvrier, bannière « pièces reçues », accordéon par dossier client.

### 2.2 Planning — `/planning`
- **Fichier** : `src/pages/Planning.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : planning des interventions par jour/semaine/mois, gestion des tâches des ouvriers.
- **Fonctionnalités** : 3 vues (jour = `PlanningHorizontalGrid`, semaine = `WeekViewGrid`, mois = `MonthViewCalendar`), filtres par type d'intervention (groupes) et par ouvrier, copier/coller de tâche (`TaskClipboardContext`), détection de chevauchements (`findOverlaps`), réordonnancement drag&drop des ouvriers (`display_order`), persistance de l'état de vue en `sessionStorage`.
- **Boutons/actions** : navigation prev/next, « Aujourd'hui », bouton « Nouvelle tâche » (ouvre `CreateTaskDialog`), clic sur une cellule vide → pré-remplissage et ouverture du dialogue de création, clic sur une tâche → navigation `/taches/:id`.
- **Données affichées** : tâches (`work_tasks`) jointes à `clients`, `client_sites`, `profiles` (assigné), liste des ouvriers actifs.
- **Données créées/modifiées** : création de tâche par collage (`work_tasks` insert), mise à jour de l'ordre d'affichage des ouvriers (`profiles.display_order`).
- **Tables Supabase** : `work_tasks`, `profiles`.
- **Composants** : `CreateTaskDialog`, `WeekViewGrid`, `MonthViewCalendar`, `PlanningHorizontalGrid`, `LayoutPage`.
- **Règles métier** : avertissement (toast) en cas de chevauchement horaire lors du collage, mais la création n'est pas bloquée.

### 2.3 Clients — `/clients`
- **Fichier** : `src/pages/Clients.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : liste et gestion des fiches clients.
- **Fonctionnalités** : recherche (nom/email/téléphone/adresse via `normalizeSearch`), vue tableau (desktop) / cartes (mobile), export CSV, import CSV.
- **Boutons/actions** : « CSV » (export), « Importer » (`ImportCsvDialog`), « Nouveau » (`CreateEditClientDialog`), clic ligne → `/clients/:id`.
- **Données affichées** : `clients.*`.
- **Données créées/modifiées** : création/édition client via dialogue, import en masse (insert `clients` en évitant les doublons nom/email).
- **Tables Supabase** : `clients`.
- **Composants** : `CreateEditClientDialog`, `ImportCsvDialog`, `LayoutPage`.

### 2.4 Détail Client — `/clients/:id`
- **Fichier** : `src/pages/ClientDetail.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : fiche complète d'un client : coordonnées, sites, équipements, historique d'interventions.
- **Fonctionnalités** : ajout/suppression de site (`client_sites`), ajout/suppression d'équipement (`client_equipment`), édition du client (`CreateEditClientDialog`), suppression du client avec confirmation (`AlertDialog`), navigation rapide vers Planning (nouvelle intervention) et Entretiens.
- **Données affichées** : `clients`, `client_sites`, `client_equipment`, historique `work_tasks` (50 dernières).
- **Données créées/modifiées/supprimées** : insert/delete `client_sites`, insert/delete `client_equipment`, update/delete `clients`.
- **Tables Supabase** : `clients`, `client_sites`, `client_equipment`, `work_tasks`.
- **Composants** : `CreateEditClientDialog`, `LayoutDetail`, `AlertDialog`.
- **Règle métier** : suppression du client cascade la suppression de ses sites/équipements (mention dans le dialogue de confirmation — vérifier contrainte FK `ON DELETE CASCADE` côté DB, **À VÉRIFIER**).

### 2.5 Entretiens — `/entretiens`
- **Fichier** : `src/pages/Entretiens.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : gestion des contrats/planifications d'entretien récurrents (`maintenance_schedules`).
- **Fonctionnalités** : 3 onglets — Liste (recherche + filtres type/statut, alertes légales à échéance ≤ 90 jours ou en retard), Mensuel (répartition par mois pour l'année en cours), Projections (N à N+3).
- **Boutons/actions** : « Nouvel entretien » (`CreateEditEntretienDialog`), clic sur une ligne → `/entretiens/:id`.
- **Données affichées** : `maintenance_schedules` joint à `clients`, `client_sites`, `client_equipment`.
- **Tables Supabase** : `maintenance_schedules`, `clients`, `client_sites`, `client_equipment` (lecture).
- **Composants** : `CreateEditEntretienDialog`, `Tabs`, `LayoutPage`.
- **Règles métier** : calcul de périodicité (`mensuel/trimestriel/.../triennal` → mois), alerte légale paramétrable (`legal_alert_years`), urgence visuelle (retard = rouge, ≤30j = orange).

### 2.6 Détail Entretien — `/entretiens/:id`
- **Fichier** : `src/pages/EntretienDetail.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : détail d'un planning d'entretien : client, propriétaire (si distinct via `owner_client_id`), site, équipement, périodicité, ouvriers assignés, binôme.
- **Fonctionnalités** : affichage détaillé, édition (`CreateEditEntretienDialog`), planification directe d'une tâche liée (`CreateTaskDialog` pré-rempli).
- **Boutons** : « Planifier cet entretien », « Modifier ».
- **Tables Supabase** : `maintenance_schedules` (avec jointures `clients`, `client_sites`, `client_equipment`, `task_binomes`), `maintenance_schedule_assignees` (lecture des ouvriers assignés jointe à `profiles`).
- **Composants** : `CreateEditEntretienDialog`, `CreateTaskDialog`, `LayoutDetail`.

### 2.7 Commandes (pièces) — `/commandes`
- **Fichier** : `src/pages/Commandes.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : suivi des commandes de pièces détachées.
- **Tables Supabase** : `parts_orders`.
- **Composants** : `CreateOrderDialog`, `OrderDetailDialog` (utilisés par cette page ou la page de détail — cf. section dialogues).
- **Fonctionnalités** : liste/filtre des commandes par statut (`demandee`, `commandee`, `recue`, `cloturee`).

### 2.8 Détail Commande — `/commandes/:id`
- **Fichier** : `src/pages/CommandeDetail.tsx`
- **Rôle** : admin/bureau.
- **Fonctionnalités** : consultation, mise à jour de statut/urgence, suppression.
- **Données créées/modifiées/supprimées** : update `parts_orders` (changement de statut), delete `parts_orders`.
- **Tables Supabase** : `parts_orders`.
- **Composants** : `CreateFollowUpTaskDialog` (créer une tâche de suivi liée à la commande).

### 2.9 Fiches (interventions) — `/fiches`
- **Fichier** : `src/pages/Fiches.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : liste des fiches d'intervention/entretien remplies par les ouvriers.
- **Tables Supabase** : `profiles`, `intervention_sheets`.
- **Fonctionnalités** : recherche/filtre, navigation vers `/fiches/:id`.

### 2.10 Détail Fiche — `/fiches/:id` (route partagée avec la PWA mobile `/mobile/fiches/:id`)
- **Fichier** : `src/pages/FicheDetail.tsx`
- **Rôle** : accessible en admin/bureau (lecture/écriture complète) et en `ouvrier` via `/mobile/fiches/:id` (lecture seule : `isReadOnly = role === "ouvrier"`).
- **Objectif** : détail d'une fiche d'intervention ou d'entretien remplie sur le terrain.
- **Fonctionnalités** : affichage des réponses de fiche, changement de statut final (`final_status`), gestion de commande de pièce associée, commentaire interne bureau, suppression, envoi au client (`SendFicheDialog`).
- **Boutons/actions** : modifier statut final, éditer commande liée, ajouter commentaire interne, supprimer la fiche, envoyer au client par email.
- **Données créées/modifiées/supprimées** : update `intervention_sheets` (`final_status`, `internal_comment`, `sent_to_client`), update `parts_orders`, delete `intervention_sheets`.
- **Tables Supabase** : `intervention_sheets`, `parts_orders`.
- **Composants** : `SendFicheDialog`, `FicheDetailDialog` (variante dialogue), `LayoutDetail`.
- **Règle métier** : les ouvriers ne peuvent pas modifier une fiche déjà soumise (lecture seule dans la PWA), seuls admin/bureau éditent le statut final/commentaire/pièce.

### 2.11 Admin (paramétrage / templates de tâches) — `/admin`
- **Fichier** : `src/pages/Admin.tsx`
- **Rôle** : condition interne stricte — `role !== "admin" && role !== "bureau" && role !== "super_admin"` → écran bloqué/redirigé (donc accessible à admin, bureau, super_admin ; exclut `ouvrier`, déjà exclu par le layout).
- **Objectif** : gestion des templates de tâches et gestion des utilisateurs de l'entreprise (si `admin`/`super_admin`).
- **Fonctionnalités** : CRUD des `task_templates`, section gestion utilisateurs (`canManageUsers = role === "super_admin" || role === "admin"`) avec création (`CreateUserDialog`, via edge function `create-user`) et édition (`EditUserDialog`, via edge function `update-user`).
- **Tables Supabase** : `task_templates` (select/insert/update/delete via `CreateEditTemplateDialog`), `profiles` (liste des utilisateurs, probablement dans un sous-composant non détaillé ici — **À VÉRIFIER** le composant de liste des utilisateurs de cette page).
- **Edge functions** : `create-user`, `update-user` (appelées depuis les dialogues, avec en-tête `Authorization: Bearer <access_token>`).
- **Composants** : `CreateEditTemplateDialog`, `CreateUserDialog`, `EditUserDialog`.
- **Règle métier** : matrice de rôles assignables (`ROLES_BY_CALLER`) — un `super_admin` peut créer `admin/bureau/ouvrier`, un `admin` peut créer `bureau/ouvrier` uniquement (pas d'auto-élévation).

### 2.12 Temps Ouvriers — `/temps-ouvriers`
- **Fichier** : `src/pages/TempsOuvriers.tsx`
- **Rôle** : condition interne identique à Admin — admin/bureau/super_admin uniquement.
- **Objectif** : suivi/reporting du temps passé par les ouvriers sur les interventions.
- **Tables Supabase** : `intervention_sheets`, `profiles`, `work_tasks`.
- **Fonctionnalités** : agrégation par ouvrier/période (calcul de durées, probablement basé sur des horodatages de fiches).

### 2.13 Devis — `/devis`
- **Fichier** : `src/pages/Devis.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : liste des devis (`quotes`).
- **Tables Supabase** : `profiles` (liste ouvriers/admin créateurs), `quotes` (delete).
- **Fonctionnalités** : suppression de devis, navigation vers détail/nouveau.

### 2.14 Nouveau Devis — `/devis/nouveau` (webapp) et `/mobile/devis/nouveau` (PWA)
- **Fichier partagé** : `src/pages/mobile/MobileDevisForm.tsx` (même composant monté sur deux routes distinctes, une dans `AppLayout`, une dans `MobileLayout`).
- **Rôle** : admin (webapp) et ouvrier autorisé (`profile.can_create_devis`) côté mobile (le lien « Devis » n'apparaît dans la bottom-nav mobile que si `role === "admin" || (role === "ouvrier" && profile?.can_create_devis)`).
- **Objectif** : création d'un devis avec upload de pièces jointes.
- **Fonctionnalités** : formulaire devis, upload de fichier vers le bucket de stockage.
- **Données créées** : insert `quotes` ; upload fichier dans le storage bucket `quote-assets` (`supabase.storage.from("quote-assets")`).
- **Tables/Storage Supabase** : `quotes` (insert), storage `quote-assets`.
- **Règle métier** : le droit de créer un devis pour un ouvrier est piloté par le flag `profiles.can_create_devis`.

### 2.15 Détail Devis — `/devis/:id`
- **Fichier** : `src/pages/DevisDetail.tsx`
- **Rôle** : admin/bureau.
- **Fonctionnalités** : consultation, changement de statut, commentaires internes, suppression.
- **Tables Supabase** : `quotes` (select joint `profiles`, update statut, update commentaires internes, delete).
- **Composants** : `DevisDetailDialog` (variante dialogue réutilisable).

### 2.16 Tâches — `/taches`
- **Fichier** : `src/pages/Taches.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : liste globale des tâches planifiées (vue alternative au planning calendrier, probablement liste/filtrage).
- **Tables Supabase** : `profiles`, `work_tasks`.

### 2.17 Détail Tâche — `/taches/:id`
- **Fichier** : `src/pages/TacheDetail.tsx`
- **Rôle** : lecture pour tous les admis à `AppLayout` ; édition réservée (`canEdit = role === "admin" || role === "bureau" || role === "super_admin"`).
- **Objectif** : détail d'une tâche planifiée : client, ouvrier assigné, binôme, commande de pièce liée, changement de statut.
- **Fonctionnalités** : changer le statut de la tâche, éditer les champs (assignation, horaires…), supprimer.
- **Données créées/modifiées/supprimées** : update `work_tasks` (statut, champs), delete `work_tasks`.
- **Tables Supabase** : `work_tasks`, `parts_orders`, `profiles`, `clients`, `task_binomes`.
- **Composants** : `TaskDetailDialog` (variante dialogue), `LayoutDetail`.

### 2.18 Dossiers (vue 360° client) — `/dossiers`
- **Fichier** : `src/pages/Dossiers.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : vue consolidée par client agrégeant tâches, entretiens, devis et commandes.
- **Tables Supabase** : `clients`, `work_tasks`, `maintenance_schedules`, `quotes`, `parts_orders` (toutes en lecture, agrégées par client).

### 2.19 Détail Dossier — `/dossiers/:id`
- **Fichier** : `src/pages/DossierDetail.tsx`
- **Rôle** : admin/bureau.
- **Objectif** : dossier complet d'un client unique (tâches, entretiens, devis, commandes liés).
- **Tables Supabase** : `clients`, `work_tasks`, `maintenance_schedules`, `parts_orders`, `quotes`.

---

## 3. PWA Mobile Ouvrier (sous `MobileLayout`, préfixe `/mobile`)

Navigation basse (bottom-nav) : Agenda, Fiches, Pièces, (Devis si autorisé), Profil. Fonctionnalités transverses : mode hors-ligne avec brouillons locaux (`useOfflineDrafts`, `draftStorage`), bannière de synchronisation, notifications push (`usePushNotifications`), notifications de nouvelles tâches (`MobileTaskNotifications`).

### 3.1 Agenda — `/mobile` (index)
- **Fichier** : `src/pages/mobile/MobileAgenda.tsx`
- **Rôle** : `ouvrier` (route cible principale), mais accessible aussi par tout utilisateur connecté ouvrant l'URL (voir remarque garde d'accès `MobileLayout`).
- **Objectif** : agenda personnel des tâches assignées à l'ouvrier connecté.
- **Tables Supabase** : `work_tasks`, `intervention_sheets`.
- **RPC** : `get_my_clients_safe` (fonction sécurisée exposant uniquement les clients liés aux tâches de l'utilisateur, évitant l'exposition de toute la table `clients`).
- **Fonctionnalités** : liste des tâches du jour/à venir, statut visuel, navigation vers détail tâche.

### 3.2 Détail Tâche mobile — `/mobile/tache/:id`
- **Fichier** : `src/pages/mobile/MobileTaskDetail.tsx`
- **Rôle** : ouvrier.
- **Objectif** : détail d'une tâche assignée : infos client, adresse, création de fiche associée.
- **Tables Supabase** : `work_tasks`, `clients`, `intervention_sheets`, `parts_orders`.
- **Actions** : lancer une nouvelle fiche (intervention ou entretien) liée à la tâche, changer le statut d'avancement.

### 3.3 Nouvelle Fiche — `/mobile/fiche/nouvelle`
- **Fichier** : `src/pages/mobile/MobileNouvelleFiche.tsx`
- **Rôle** : ouvrier.
- **Objectif** : point d'entrée pour créer une fiche sans tâche préexistante (saisie libre).
- **RPC** : `get_my_clients_safe`.
- **Tables Supabase** : `work_tasks` (lecture, probablement pour rattacher/choisir une tâche).

### 3.4 Router de fiche par tâche — `/mobile/fiche/:taskId`
- **Fichier** : `src/pages/mobile/MobileFicheRouter.tsx`
- **Rôle** : ouvrier.
- **Objectif** : aiguille vers le bon formulaire de fiche selon le type d'intervention de la tâche (`work_tasks.intervention_type`) : formulaire « Entretien » ou « Intervention ».
- **Tables Supabase** : `work_tasks` (lecture du type pour routage).
- **Composants enfants** : `MobileFicheEntretienForm`, `MobileFicheInterventionForm`, `MobileFicheForm` (générique/commun).

#### 3.4.a MobileFicheEntretienForm (`src/pages/mobile/MobileFicheEntretienForm.tsx`)
- **Objectif** : formulaire de fiche pour un entretien (checklist réglementaire, mesures, etc.).
- **Tables Supabase** : `intervention_sheets` (insert/update du brouillon final), `work_tasks` (mise à jour du statut de la tâche liée).
- **Fonctionnalités** : sauvegarde locale (brouillon offline) via `draftStorage`, soumission finale, signature/photo (à confirmer selon composants internes non détaillés ici — **À VÉRIFIER**).

#### 3.4.b MobileFicheInterventionForm (`src/pages/mobile/MobileFicheInterventionForm.tsx`)
- **Objectif** : formulaire de fiche pour une intervention/dépannage.
- **Tables Supabase** : `intervention_sheets`, `work_tasks`.

#### 3.4.c MobileFicheForm (`src/pages/mobile/MobileFicheForm.tsx`)
- **Objectif** : composant de formulaire partagé/commun (champs génériques réutilisés par les deux formulaires ci-dessus). Aucun accès direct aux tables constaté dans ce fichier (délégué aux formulaires spécialisés).

### 3.5 Mes Fiches — `/mobile/fiches`
- **Fichier** : `src/pages/mobile/MobileFiches.tsx`
- **Rôle** : ouvrier.
- **Objectif** : liste des fiches créées par l'ouvrier (envoyées + brouillons locaux en attente de synchronisation).
- **Tables Supabase** : `intervention_sheets`, `work_tasks`.
- **RPC** : `get_my_clients_safe`.
- **Fonctionnalités** : badge du nombre de brouillons en attente, accès à l'écran de synchronisation offline.

### 3.6 Détail Fiche (mobile) — `/mobile/fiches/:id`
- Réutilise **`src/pages/FicheDetail.tsx`** (même composant que la route webapp `/fiches/:id`), en mode lecture seule pour le rôle `ouvrier` (`isReadOnly`).

### 3.7 Pièces — `/mobile/pieces`
- **Fichier** : `src/pages/mobile/MobilePieces.tsx`
- **Rôle** : ouvrier.
- **Objectif** : demander une commande de pièce détachée depuis le terrain.
- **Tables Supabase** : `parts_orders` (insert), `work_tasks` (lecture pour rattacher la commande à une tâche).
- **RPC** : `get_my_clients_safe`.
- **Fonctionnalités** : formulaire de demande de pièce (nom, urgence), liste des demandes en cours.

### 3.8 Profil — `/mobile/profil`
- **Fichier** : `src/pages/mobile/MobileProfil.tsx`
- **Rôle** : ouvrier (et tout utilisateur du layout mobile).
- **Objectif** : affichage identité (nom, email, rôle, niveau ouvrier) et déconnexion.
- **Tables Supabase** : aucune (données issues du contexte `useAuth`).
- **Actions** : bouton « Déconnexion » (`signOut`).

### 3.9 Nouveau Devis (mobile) — `/mobile/devis/nouveau`
- Voir section 2.14 (composant partagé `MobileDevisForm`). Visible dans la bottom-nav uniquement si `profile.can_create_devis` est vrai pour un ouvrier.

---

## 4. Console Super Admin (sous `SuperAdminLayout`, préfixe `/super-admin`)

Accès strict : session + `role === "super_admin"` sinon redirection `/`.

### 4.1 Dashboard Super Admin — `/super-admin` (index)
- **Fichier** : `src/pages/super-admin/SuperAdminDashboard.tsx`
- **Objectif** : vue globale multi-entreprises (SaaS) : nombre d'entreprises, d'utilisateurs, de tâches.
- **Tables Supabase** : `companies`, `profiles`, `work_tasks` (comptage global toutes entreprises confondues — nécessite des policies RLS spécifiques au rôle `super_admin`, **À VÉRIFIER** dans les migrations SQL).

### 4.2 Entreprises — `/super-admin/companies`
- **Fichier** : `src/pages/super-admin/SuperAdminCompanies.tsx`
- **Objectif** : gestion des entreprises clientes de la plateforme (multi-tenant).
- **Fonctionnalités** : liste des entreprises avec statut actif/inactif et nombre d'utilisateurs, création/édition d'entreprise (nom, nom d'affichage, logo), upload de logo.
- **Données créées/modifiées** : insert/update `companies`, upload storage bucket `company-assets`.
- **Tables/Storage Supabase** : `companies`, `profiles` (comptage par `company_id`), storage `company-assets`.

### 4.3 Utilisateurs — `/super-admin/users`
- **Fichier** : `src/pages/super-admin/SuperAdminUsers.tsx`
- **Objectif** : gestion de tous les utilisateurs toutes entreprises confondues.
- **Fonctionnalités** : liste filtrable par entreprise, création d'utilisateur (edge function `create-user`), modification (rôle, statut actif, `company_id`, `can_create_devis`, etc. via update direct `profiles`).
- **Tables Supabase** : `companies` (liste pour filtre/association), `profiles` (select/update).
- **Edge functions** : `create-user`.

### 4.4 Paramètres plateforme — `/super-admin/settings`
- **Fichier** : `src/pages/super-admin/SuperAdminSettings.tsx`
- **Objectif** : réglages globaux de la plateforme (ex. paramètres d'emails transactionnels, valeurs par défaut).
- **Tables Supabase** : `platform_settings` (select/update).

### 4.5 Journal d'activité — `/super-admin/logs`
- **Fichier** : `src/pages/super-admin/SuperAdminLogs.tsx`
- **Objectif** : consultation des logs d'activité de toute la plateforme (audit).
- **Tables Supabase** : `activity_logs` (jointes potentiellement à `profiles`, `companies` pour affichage lisible).
- **Fonctionnalités** : filtres (par entreprise, par utilisateur, par action), pagination.

---

## 5. Dialogues et écrans secondaires

Ces composants ne sont pas des routes mais des « écrans » modaux ouverts depuis les pages ci-dessus ; ils portent une part importante de la logique métier (formulaires de création/édition).

| Dialogue | Fichier | Ouvert depuis | Tables Supabase | Edge functions |
|---|---|---|---|---|
| Créer/éditer client | `src/components/clients/CreateEditClientDialog.tsx` | Clients, ClientDetail | `clients`, `client_sites`, `client_equipment` (insert/update) | — |
| Détail client (variante dialogue) | `src/components/clients/ClientDetailDialog.tsx` | (réutilisable ailleurs) | `client_sites`, `client_equipment`, `work_tasks`, `clients` (delete) | — |
| Import CSV clients | `src/components/clients/ImportCsvDialog.tsx` | Clients | `clients` (select existants pour dédoublonnage, insert en masse) | — |
| Créer/éditer entretien | `src/components/entretiens/CreateEditEntretienDialog.tsx` | Entretiens, EntretienDetail | `clients`, `client_sites`, `client_equipment`, `task_binomes`, `maintenance_schedules` (insert/update) | — |
| Détail entretien (variante dialogue) | `src/components/entretiens/EntretienDetailDialog.tsx` | (réutilisable) | aucune requête directe constatée | — |
| Créer tâche | `src/components/planning/CreateTaskDialog.tsx` | Planning, EntretienDetail | `profiles`, `clients`, `task_binomes`, `work_tasks` (insert), `work_task_assignees` (insert) | — |
| Détail tâche (variante dialogue) | `src/components/planning/TaskDetailDialog.tsx` | (réutilisable, ex. TacheDetail) | `profiles`, `clients`, `task_binomes`, `work_tasks` (update/delete) | — |
| Créer commande pièce | `src/components/commandes/CreateOrderDialog.tsx` | Commandes | `clients`, `work_tasks`, `parts_orders` (insert) | — |
| Détail commande (variante dialogue) | `src/components/commandes/OrderDetailDialog.tsx` | Commandes | `parts_orders` (update) | — |
| Créer tâche de suivi (depuis commande) | `src/components/commandes/CreateFollowUpTaskDialog.tsx` | CommandeDetail | `profiles`, `work_tasks` (insert) | — |
| Détail devis (variante dialogue) | `src/components/devis/DevisDetailDialog.tsx` | (réutilisable) | `quotes` (update statut/commentaires) | — |
| Détail fiche (variante dialogue) | `src/components/fiches/FicheDetailDialog.tsx` | (réutilisable) | `intervention_sheets` (update `sent_to_client`) | — |
| Envoyer fiche par email | `src/components/fiches/SendFicheDialog.tsx` | FicheDetail | `email_settings` (lecture config d'envoi) | `send-transactional-email` (probable — **À VÉRIFIER**, non gréppé directement dans ce fichier) |
| Créer/éditer template de tâche | `src/components/admin/CreateEditTemplateDialog.tsx` | Admin | `task_templates` (insert/update) | — |
| Créer utilisateur | `src/components/admin/CreateUserDialog.tsx` | Admin | — | `create-user` (fetch direct avec Bearer token) |
| Éditer utilisateur | `src/components/admin/EditUserDialog.tsx` | Admin | — | `update-user` (fetch direct avec Bearer token) |

### Autres écrans secondaires notables (non-dialogues classiques)
- **OfflineSyncSheet** (`src/components/mobile/OfflineSyncSheet.tsx`) : feuille (Sheet) accessible depuis `MobileLayout` listant les brouillons de fiches hors-ligne, avec actions « resynchroniser » / « abandonner » par brouillon.
- **MobileTaskNotifications** (`src/components/mobile/MobileTaskNotifications.tsx`) : bandeau de notification de nouvelles tâches assignées en temps réel (probable écoute Realtime sur `work_tasks`, **À VÉRIFIER**).
- **RealtimeOrderNotifications** (`src/components/layout/RealtimeOrderNotifications.tsx`) : notification temps réel dans l'en-tête d'`AppLayout` (probable écoute Realtime sur `parts_orders`, **À VÉRIFIER**).

---

## 6. Tableau récapitulatif route → rôles → tables

| Route | Rôle(s) autorisé(s) | Tables `.from("...")` principales | RPC / Edge functions |
|---|---|---|---|
| `/auth` | public | `activity_logs` (insert login) | — |
| `/install` | public | — | — |
| `/unsubscribe` | public (token) | — (délégué à l'edge function) | `handle-email-unsubscribe` |
| `/` (Dashboard) | admin, bureau | `parts_orders`, `maintenance_schedules`, `work_tasks`, `clients`, `intervention_sheets`, `profiles` | — |
| `/planning` | admin, bureau | `work_tasks`, `profiles`, `clients`, `client_sites`, `task_binomes` | — |
| `/clients` | admin, bureau | `clients` | — |
| `/clients/:id` | admin, bureau | `clients`, `client_sites`, `client_equipment`, `work_tasks` | — |
| `/entretiens` | admin, bureau | `maintenance_schedules`, `clients`, `client_sites`, `client_equipment` | — |
| `/entretiens/:id` | admin, bureau | `maintenance_schedules`, `maintenance_schedule_assignees`, `clients`, `client_sites`, `client_equipment`, `task_binomes` | — |
| `/commandes` | admin, bureau | `parts_orders` | — |
| `/commandes/:id` | admin, bureau | `parts_orders`, `profiles`, `work_tasks` | — |
| `/fiches` | admin, bureau | `profiles`, `intervention_sheets` | — |
| `/fiches/:id` | admin, bureau (rw) / ouvrier via `/mobile/fiches/:id` (lecture seule) | `intervention_sheets`, `parts_orders` | — |
| `/admin` | admin, bureau, super_admin | `task_templates`, `profiles` | `create-user`, `update-user` |
| `/temps-ouvriers` | admin, bureau, super_admin | `intervention_sheets`, `profiles`, `work_tasks` | — |
| `/devis` | admin, bureau | `profiles`, `quotes` | — |
| `/devis/nouveau` | admin (webapp) | `quotes`, storage `quote-assets` | — |
| `/devis/:id` | admin, bureau | `quotes`, `profiles` | — |
| `/taches` | admin, bureau | `profiles`, `work_tasks` | — |
| `/taches/:id` | admin, bureau (lecture pour tous les admis, édition admin/bureau/super_admin) | `work_tasks`, `parts_orders`, `profiles`, `clients`, `task_binomes` | — |
| `/dossiers` | admin, bureau | `clients`, `work_tasks`, `maintenance_schedules`, `quotes`, `parts_orders` | — |
| `/dossiers/:id` | admin, bureau | `clients`, `work_tasks`, `maintenance_schedules`, `parts_orders`, `quotes` | — |
| `/mobile` (Agenda) | ouvrier | `work_tasks`, `intervention_sheets` | `get_my_clients_safe` |
| `/mobile/tache/:id` | ouvrier | `work_tasks`, `clients`, `intervention_sheets`, `parts_orders` | — |
| `/mobile/fiche/nouvelle` | ouvrier | `work_tasks` | `get_my_clients_safe` |
| `/mobile/fiche/:taskId` | ouvrier | `work_tasks`, `intervention_sheets` | — |
| `/mobile/fiches` | ouvrier | `intervention_sheets`, `work_tasks` | `get_my_clients_safe` |
| `/mobile/fiches/:id` | ouvrier (lecture seule) | `intervention_sheets`, `parts_orders` | — |
| `/mobile/pieces` | ouvrier | `parts_orders`, `work_tasks` | `get_my_clients_safe` |
| `/mobile/profil` | ouvrier | — (contexte `useAuth`) | — |
| `/mobile/devis/nouveau` | ouvrier si `can_create_devis`, admin | `quotes`, storage `quote-assets` | — |
| `/super-admin` | super_admin | `companies`, `profiles`, `work_tasks` | — |
| `/super-admin/companies` | super_admin | `companies`, `profiles`, storage `company-assets` | — |
| `/super-admin/users` | super_admin | `companies`, `profiles` | `create-user` |
| `/super-admin/settings` | super_admin | `platform_settings` | — |
| `/super-admin/logs` | super_admin | `activity_logs`, `profiles`, `companies` | — |
| `*` (404) | public | — | — |

### Edge functions listées dans `supabase/functions/` (usage à confirmer écran par écran — **À VÉRIFIER** pour celles non tracées ci-dessus)
`analyze-nameplate`, `cleanup-orphan-auth`, `create-user`, `handle-email-suppression`, `handle-email-unsubscribe`, `preview-transactional-email`, `process-email-queue`, `security-monitor`, `send-entretien-reminders`, `send-push`, `send-transactional-email`, `update-user`.
- `create-user` / `update-user` : confirmés utilisés (Admin, SuperAdminUsers).
- `handle-email-unsubscribe` : confirmé utilisé (Unsubscribe).
- Les autres (`analyze-nameplate`, `cleanup-orphan-auth`, `handle-email-suppression`, `preview-transactional-email`, `process-email-queue`, `security-monitor`, `send-entretien-reminders`, `send-push`, `send-transactional-email`) n'ont pas été retrouvées par appel direct `functions.invoke`/`fetch` dans les pages/dialogues explorés ci-dessus : elles sont probablement invoquées soit par des tâches planifiées (cron), soit par des composants non couverts par cet inventaire de pages (ex. `usePushNotifications`, `MobileTaskNotifications`), soit par d'autres edge functions entre elles. **À VÉRIFIER** en grep sur l'ensemble de `src/` et `supabase/functions/*/index.ts` pour tracer chaque appelant exact.
