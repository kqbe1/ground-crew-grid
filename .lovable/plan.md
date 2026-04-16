

# Nettoyage du code mort

## Étapes

### 1. Supprimer 3 fichiers inutilisés
- `src/components/NavLink.tsx` — aucun import trouvé
- `src/App.css` — aucun import trouvé
- `src/pages/Index.tsx` — aucune route active

### 2. Retirer `super_admin` des navItems
- **`src/components/layout/AppSidebar.tsx`** : retirer `"super_admin"` des tableaux `roles` dans `navItems` (lignes 22-31)
- **`src/components/layout/MobileBottomNav.tsx`** : retirer `"super_admin"` des tableaux `roles` dans `primaryNav` (lignes 22-25) et `secondaryNav` (lignes 28-33)

Aucun risque fonctionnel : `AppLayout` redirige `super_admin` avant que ces composants ne soient rendus.

