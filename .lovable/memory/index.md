# Project Memory

## Core
SaaS multi-tenant pour PME de terrain: Webapp (Admin/Bureau) + PWA/Capacitor (Ouvrier offline-first).
Périmètre: planning, interventions, et devis. AUCUNE facturation, compta ou ERP.
Architecture multi-tenant via `company_id`. Le Super Admin (accès global) a `company_id = NULL`.
Rôles (Badges): Super Admin (Ambre), Admin (Rouge), Bureau (Bleu), Ouvrier (Mobile).
Règle signature: Seule la signature du client est capturée pour clôturer une tâche. Aucune signature interne.
Contrainte Supabase: Ne JAMAIS utiliser `head: true` pour les comptages (erreurs CORS). Utiliser GET `{ count: 'exact' }`.
Responsive: AppLayout et SuperAdminLayout adaptent sidebar→bottom nav sur mobile. Toutes les pages supportent mobile.

## Memories
- [Vue d'ensemble](mem://projet/vue-d-ensemble) — SaaS for SME field workers with Webapp & Mobile PWA
- [Direction visuelle](mem://style/direction-visuelle) — Role badge colors, sidebar layout, task card dimensions
- [Infrastructure tech](mem://tech/infrastructure) — Hybrid PWA/Capacitor, Supabase, IndexedDB offline persistence
- [Signatures](mem://metier/signatures) — Rule: Only client signatures allowed for interventions
- [Périmètre exclu](mem://metier/perimetre-exclu) — Forbidden features: facturation, ERP, CRM (devis now allowed)
- [Conception plateformes](mem://ui/conception-plateformes) — Webapp vs PWA mobile strict separation, offline drafts
- [Equipements & Energies](mem://metier/equipements-energies) — Equipment domains: gaz, mazout, pellets, clim, VMC
- [Flux planning](mem://metier/flux-travail-planning) — 3 views planning, conflicts, templates, chronological sort
- [Intégration Odoo/Calendrier](mem://integrations/externe-calendrier-odoo) — Calendar sync and future Odoo contacts API
- [Commandes pièces](mem://metier/automatisation-commandes-statuts) — Part tracking statuses, auto-replan via mobile request
- [Conflits planning](mem://metier/planning-conflits) — 15min overlap detection with visual alerts
- [Notifications realtime](mem://metier/notifications-temps-reel) — Supabase Realtime + FCM push for tasks and parts
- [Installation PWA](mem://ui/pwa-installation) — Dedicated /install page for Android/iOS instructions
- [Stockage fichiers](mem://tech/stockage-fichiers) — Supabase Storage RLS rules, company vs intervention assets
- [Gestion liste tâches](mem://metier/taches-gestion-liste) — Dedicated tasks list, reverse chronological, smart search
- [Multi-tenant DB](mem://tech/architecture-multi-tenant) — Isolated tenant DB schema via company_id and Postgres triggers
- [Hiérarchie RBAC](mem://auth/rbac-hierarchie-multi-tenant) — Roles permissions, Super Admin/Admin/Bureau/Ouvrier
- [Interface Superadmin](mem://ui/interface-superadmin) — Global dashboard /super-admin, quotas, platform settings
- [Identité visuelle tenant](mem://ui/identite-visuelle-tenant) — Custom company logos and colors via Supabase storage
- [Gestion clients](mem://metier/gestion-clients) — Multi-site clients, CSV import/export structuring
- [Fiches d'intervention](mem://metier/fiches-intervention) — Mobile checklists, signatures, photos, and live PDF previews
- [Entretiens maintenance](mem://metier/entretiens-maintenance) — Recurring maintenance based on Belgian regional rules
- [Suivi temps](mem://metier/suivi-temps-travail) — Time tracking dashboard via Recharts with sliding periods
- [Dashboard Stats Admin](mem://metier/dashboard-stats-admin) — Macro statistics and multi-year projection views
- [UX saisie temps mobile](mem://ui/mobile-ux-time-input) — Custom TimeInput HH:MM component with inputMode numeric
- [Flux interventions dashboard](mem://ui/dashboard-flux-interventions) — Realtime feed of 5 most recent worker submissions
- [Filtres interventions unifiés](mem://ui/filtres-interventions-unifies) — Unified "Entretien" filter grouping all energy types
- [Contraintes Sandbox Supabase](mem://tech/contraintes-sandbox-supabase) — Avoid head: true for line counts due to CORS errors
- [Gestion utilisateurs backend](mem://tech/gestion-utilisateurs-backend) — Edge functions for user lifecycle and cascading deletes
- [Journal d'audit](mem://tech/journal-audit) — Centralized activity_logs via Postgres triggers and edge functions
- [Module Devis](mem://metier/module-devis) — Quote request system with 8-step mobile form, bureau management
