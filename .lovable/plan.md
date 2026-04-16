

# Plan mis à jour : Module Devis + Responsive mobile tous rôles

## Ajout par rapport au plan précédent

Actuellement, seul le rôle `ouvrier` accède à l'interface mobile (`/mobile`). Les rôles `admin` et `bureau` sont redirigés vers la webapp desktop, qui n'est pas optimisée pour mobile (sidebar fixe, tableaux larges). L'objectif est que **tous les rôles** bénéficient d'une expérience mobile adaptée quand ils utilisent un petit écran.

---

## Stratégie responsive

```text
┌──────────────────────────────────────────────────┐
│  Écran < 768px (mobile)                          │
│  ─────────────────────                           │
│  Admin/Bureau : AppLayout adapté                 │
│    - Sidebar → bottom nav ou hamburger menu      │
│    - Tableaux → cards empilées                   │
│    - Accès au formulaire devis mobile            │
│  Ouvrier : MobileLayout (inchangé)               │
│  SuperAdmin : layout responsive aussi            │
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│  Écran ≥ 768px (desktop/tablette)                │
│  ─────────────────────────────                   │
│  Tous rôles : layout actuel inchangé             │
└──────────────────────────────────────────────────┘
```

## Modifications responsive (en plus du module Devis)

### 1. AppLayout responsive

- Détecter la taille écran via `useIsMobile()`
- **Mobile** : masquer la sidebar, afficher une **bottom navigation bar** (même style que MobileLayout) avec les onglets principaux + un menu hamburger pour les secondaires
- **Desktop** : comportement actuel inchangé

### 2. AppSidebar → MobileBottomNav conditionnel

- Créer `src/components/layout/MobileBottomNav.tsx` : barre de navigation fixe en bas avec les 4-5 onglets les plus importants (Dashboard, Planning, Tâches, Devis, Plus…)
- Le bouton "Plus…" ouvre un drawer/sheet avec les onglets restants (Clients, Entretiens, Commandes, Fiches, Temps, Admin)
- Filtré par rôle comme la sidebar actuelle

### 3. Pages liste responsives

Adapter les pages existantes (Fiches, Commandes, Clients, Entretiens, Tâches, Temps, Devis) :
- **Mobile** : remplacer les tableaux par des listes de cards empilées (même style que MobileFiches/MobilePieces)
- **Desktop** : tableaux inchangés
- Utiliser `useIsMobile()` pour switcher entre les deux rendus
- Les filtres passent dans un drawer/sheet au lieu d'être en ligne

### 4. Dialogs responsifs

- Les dialogs de détail (FicheDetailDialog, DevisDetailDialog, etc.) utilisent `Drawer` sur mobile au lieu de `Dialog`
- Pattern : composant wrapper qui choisit Dialog ou Drawer selon `useIsMobile()`

### 5. SuperAdminLayout responsive

- Même approche : bottom nav sur mobile avec les onglets super-admin

### 6. Formulaire Devis accessible à admin/bureau sur mobile

- La route `/mobile/devis/nouveau` reste le formulaire multi-étapes
- Depuis l'AppLayout mobile (admin/bureau sur petit écran), un bouton FAB ou lien dans la nav mène à ce formulaire
- Le admin n'a pas besoin d'être redirigé vers `/mobile` — il accède au formulaire devis directement depuis son layout adapté

---

## Fichiers impactés (responsive uniquement, en plus du plan Devis)

| Fichier | Action |
|---------|--------|
| `src/components/layout/AppLayout.tsx` | Détection mobile, switch sidebar → bottom nav |
| `src/components/layout/MobileBottomNav.tsx` | **Nouveau** — bottom nav pour admin/bureau mobile |
| `src/components/layout/SuperAdminLayout.tsx` | Même adaptation responsive |
| `src/pages/Fiches.tsx` | Vue cards mobile |
| `src/pages/Commandes.tsx` | Vue cards mobile |
| `src/pages/Clients.tsx` | Vue cards mobile |
| `src/pages/Entretiens.tsx` | Vue cards mobile |
| `src/pages/Taches.tsx` | Vue cards mobile |
| `src/pages/TempsOuvriers.tsx` | Vue cards mobile |
| `src/pages/Devis.tsx` | Vue cards mobile (intégré dès la création) |
| `src/pages/Dashboard.tsx` | Grille responsive (colonnes empilées) |
| `src/components/devis/DevisDetailDialog.tsx` | Drawer sur mobile |
| `src/components/fiches/FicheDetailDialog.tsx` | Drawer sur mobile |
| Autres dialogs de détail | Drawer sur mobile |

## Ordre d'implémentation

1. Migration DB + table quotes + bucket storage + colonne profiles
2. Constants et types devis
3. MobileBottomNav + AppLayout responsive
4. Page Devis webapp (liste + détail) — responsive dès le départ
5. Formulaire mobile devis 8 étapes
6. Adaptation responsive des pages existantes (Fiches, Commandes, etc.)
7. SuperAdminLayout responsive
8. Toggle admin can_create_devis
9. PDF devis
10. Mémoire projet mise à jour

