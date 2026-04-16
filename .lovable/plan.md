

# Refonte du Dashboard Bureau

## Résumé
Créer un nouveau dashboard dédié au rôle "bureau" avec un système de filtres par cards, un bandeau "Fiches reçues", une liste tabulaire paginée et un mode accordéon pour les dossiers en cours. Le dashboard admin actuel reste inchangé.

## Architecture

Le fichier `src/pages/Dashboard.tsx` deviendra un aiguilleur basé sur le rôle (`useAuth`). Le rôle "admin" conserve le composant actuel (renommé `AdminDashboard`). Le rôle "bureau" charge le nouveau `BureauDashboard`.

```text
Dashboard.tsx (aiguilleur)
├── AdminDashboard.tsx  (code actuel, déplacé)
└── BureauDashboard/
    ├── BureauDashboard.tsx        (composant principal)
    ├── BureauFilterCards.tsx       (6 cards filtres)
    ├── BureauReceivedBanner.tsx    (bandeau bleu)
    ├── BureauFilterBar.tsx         (dropdowns type/tech + recherche)
    ├── BureauFicheTable.tsx        (liste plate avec pagination/tri)
    └── BureauDossierAccordion.tsx  (mode accordéon par client)
```

## Étapes d'implémentation

### 1. Extraire le dashboard admin
- Déplacer le contenu actuel de `Dashboard.tsx` dans `src/components/dashboard/AdminDashboard.tsx`
- `Dashboard.tsx` importe `useAuth`, affiche `AdminDashboard` si role=admin, `BureauDashboard` si role=bureau

### 2. Créer BureauDashboard (composant principal)
- **En-tête** : "Tableau de bord — X fiches" + boutons "Télécharger ZIP" et "Actualiser"
- **State** : `activeFilter` (card active ou `"received"`), `typeFilter`, `techFilter`, `searchClient`, `page`, `sortColumn`, `sortDir`
- **Données** : une seule requête Supabase chargeant les fiches unifiées (intervention_sheets + quotes) avec jointures sur work_tasks, clients, profiles
- Au chargement : `activeFilter = "received"` (bandeau actif par défaut)

### 3. Créer BureauFilterCards (6 cards)
- 6 cards en grille horizontale avec icône, label, compteur
- Cards : En attente, Dossier en cours, Commande, SAV, Clôturées, Devis
- Logique de comptage via des requêtes `count: 'exact'` sur les tables pertinentes
- Clic : active la card, désactive le bandeau

### 4. Créer BureauReceivedBanner (bandeau bleu)
- Bandeau bleu cliquable sous les cards
- Badge rouge avec nombre de fiches non traitées (intervention_sheets + quotes récentes non encore vues)
- Clic : active le bandeau, désactive les cards

### 5. Créer BureauFilterBar
- Dropdown "Type" : Toutes / FI / FE / FD
- Dropdown "Technicien" : Tous / liste des ouvriers (query profiles where role=ouvrier)
- Input recherche "Client"
- Ces filtres s'appliquent en complément du filtre card/bandeau

### 6. Créer BureauFicheTable (liste plate)
- Colonnes : Type (badge +FI/+FE/+FD), Tech (T0/T1...), Client, Localité, Date & Heure, Statut (badge coloré), Actions (poubelle)
- Suppression avec dialog de confirmation
- Pagination (20 par page) et tri par colonnes
- Clic sur ligne → navigation vers la vue détail plein écran (`/fiches/:id` ou `/devis/:id`)

### 7. Créer BureauDossierAccordion (mode accordéon)
- Utilisé uniquement quand card "Dossier en cours" active
- Fiches groupées par client_id
- En-tête accordéon : icône + nom client + localité + badge "X fiches" + chevron
- Contenu déplié : même colonnes que la liste plate

### 8. Logique de données unifiée
- Les "fiches" sont un type unifié mélangeant `intervention_sheets` (FI ou FE selon `entretien_type`) et `quotes` (FD)
- Mapping des filtres cards vers les requêtes :
  - **En attente** : tasks avec status `a_replanifier` + quotes `en_attente`
  - **Dossier en cours** : clients ayant des tasks/orders actives, groupés par client
  - **Commande** : parts_orders status `demandee` ou `commandee`
  - **SAV** : tasks status `sav` + quotes status `sav`
  - **Clôturées** : sheets avec final_status `termine` + quotes `cloture`
  - **Devis** : toutes les quotes
  - **Fiches reçues** : sheets récentes `is_draft=false` + quotes récentes

## Détails techniques

- Pas de migration DB nécessaire
- Composants dans `src/components/dashboard/bureau/`
- Réutilisation des composants UI existants (Card, Badge, Table, Select, Input, Collapsible, AlertDialog)
- Réutilisation des constantes de `src/lib/constants.ts` pour les labels/couleurs

