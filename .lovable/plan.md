# Lot de modifications — Bureau / Admin / Planning / Fiches

## 1. Formulaire création de tâche (Planning)

`src/components/planning/CreateTaskDialog.tsx`
- Réordonner les champs : **Client** placé en premier (au-dessus de Titre).
- Bug horaire lors du clic sur un créneau : le brouillon `sessionStorage` (`create_task_draft_v1`) restaure l'ancien `startTime` et ignore le `defaultHour/defaultMinute` reçu. Correction : quand le dialog s'ouvre via un clic créneau, on force `startTime/scheduledDate/duration/assignedTo` à partir des `default*` props (priorité contexte > draft). Le draft reste utilisé uniquement si le dialog est ouvert via le bouton « Nouvelle tâche ».

## 2. Niveaux techniciens T0 → T20

- `src/lib/constants.ts` : étendre `WORKER_LEVELS` et `WORKER_LEVEL_LABELS` jusque T20.
- Aucun changement de schéma : `worker_level` est déjà du texte libre.
- Vérifier que `CreateUserDialog` et `EditUserDialog` affichent bien la liste complète (scroll Select déjà géré).

## 3. Binômes B0 → B20 (dropdown dans la création de tâche + fiches)

Constat : la table `binomes` existe mais n'est pas utilisée. Les fiches d'intervention stockent juste `binome_name` (texte libre) et `binome_percentage`. La demande = une nomenclature **B0…B20** réutilisable et liée à un nom (ex. « stagiaire Pierre »).

Approche minimale, alignée sur les techniciens :
- Ajouter une colonne `binome_level` (text) sur `profiles` pour permettre d'assigner un label B0…B20 à un utilisateur (en plus de `worker_level`). Optionnel par utilisateur.
- `src/lib/constants.ts` : `BINOME_LEVELS = ["B0".."B20"]` + labels.
- Admin → onglet Utilisateurs : dans `CreateUserDialog` / `EditUserDialog`, ajouter un champ « Niveau binôme » (Select B0–B20 ou vide).
- `CreateTaskDialog` : nouveau Select « Binôme » listant les profils ayant un `binome_level` non nul, affichés `B3 — Pierre`. Stocke l'id dans `work_tasks.second_assigned_to` (colonne déjà existante).
- Fiches mobiles (`MobileFicheInterventionForm` + `MobileFicheEntretienForm`) : si la tâche a un `second_assigned_to`, pré-remplir `binomeName` avec `Bx — Nom` et permettre de garder la saisie du pourcentage.
- PDFs (`generateFichePdf`) : afficher `Bx — Nom (XX%)` quand présent.

## 4. Création/édition client

`src/components/clients/CreateEditClientDialog.tsx`
- **Propriétaire dans fiche locataire** : le champ « Contact locataire » devient bidirectionnel — si la fiche client courante est un locataire, le « contact propriétaire » (renommer `contact_syndic` → label « Propriétaire / Syndic » côté UI, valeur DB inchangée) sera affiché en bas comme contact responsable. Pas de migration : on réutilise `contact_syndic` comme champ « propriétaire ».
- **Adresse d'intervention → site automatique** : à la création (ou édition si l'adresse change) du client, si `address_intervention` est rempli, insérer/mettre à jour une ligne dans `client_sites` (`address = address_intervention`, label « Adresse principale »). Sans doublon : on cherche d'abord un site existant avec la même adresse.
- **Équipements à la création** : actuellement le formulaire ne permet d'ajouter des équipements qu'après création (car `client_equipment` exige un `client_id`). Correction : permettre la saisie d'une liste d'équipements temporaire dans le dialog et les insérer en batch **après** l'INSERT du client (deux phases : create client → get id → insert sites + equipments). Réutiliser le composant d'édition d'équipements existant côté `ClientDetail`.

## 5. Échéances légales d'entretien — configurables par le bureau

Aujourd'hui la périodicité est saisie manuellement sur chaque entretien. Demande : avoir un référentiel **par entreprise** `(combustible × région) → périodicité légale`.

Nouvelle table `legal_maintenance_rules` :
- `company_id uuid`, `energy_type text` (gaz/mazout/pellets/clim/vmc), `region text` (bruxelles/wallonie/flandre), `periodicity text` (mensuel/.../triennal), unique `(company_id, energy_type, region)`.
- RLS multi-tenant (lecture authenticated tenant + super_admin, écriture admin/bureau du tenant + super_admin) + GRANT.
- Seed initial avec les valeurs belges usuelles (gaz annuel partout, mazout annuel, etc.).

Interface :
- Nouvel onglet **« Entretiens légaux »** dans `src/pages/Admin.tsx` (accessible bureau + admin + super_admin) avec une matrice combustible × région éditable.
- `CreateEditEntretienDialog` : quand l'utilisateur choisit `intervention_type` + (région du client), pré-remplir `periodicity` depuis la règle correspondante. L'utilisateur peut surcharger.

## 6. Portée multi-tenant / rôles bureau

Toutes les nouvelles policies / accès UI doivent vérifier `private.is_admin_or_bureau()` + `company_id = private.get_my_company_id()` pour s'appliquer identiquement à chaque bureau d'entreprise. L'onglet « Entretiens légaux » et la gestion des binômes seront ouverts au rôle `bureau` au même titre qu'`admin`.

## Détails techniques (récap fichiers)

- Migrations : `legal_maintenance_rules` (+seed) ; `profiles.binome_level text`.
- Constants : `WORKER_LEVELS` (T0–T20), `BINOME_LEVELS` (B0–B20) + labels.
- UI Admin : nouvel onglet `LegalRulesTab.tsx`.
- Planning : refactor `CreateTaskDialog` (ordre champs, fix défaut horaire, Select binôme).
- Clients : refactor `CreateEditClientDialog` (équipements à la création, site auto, libellé propriétaire).
- Mobile + PDF : intégration du binôme `Bx — Nom`.

## Points à confirmer

- Liste exacte des `(combustible, région) → périodicité` à seed (sinon je mets les valeurs belges standard et tu pourras les ajuster dans l'UI).
- Ok pour réutiliser la colonne existante `contact_syndic` comme « Propriétaire/Syndic » (pas de nouvelle colonne) ?
- Ok pour stocker le binôme via `second_assigned_to` (id profil) au lieu d'inventer un table de liens ?
