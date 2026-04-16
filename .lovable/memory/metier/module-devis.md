---
name: Module Devis
description: Quote request system with 8-step mobile form, bureau management, and PDF generation
type: feature
---
Module de demande de devis ajouté en avril 2026.

## Architecture
- Table `quotes` avec enums `quote_status` et `installation_type`
- Bucket Storage `quote-assets` (privé) pour photos, plans, notes vocales
- Colonne `can_create_devis` sur `profiles` pour activation par ouvrier

## Workflow
1. Admin (toujours) ou ouvrier autorisé crée un devis via formulaire mobile 8 étapes
2. Le devis arrive en statut "En attente" dans la liste bureau
3. Le bureau gère les statuts : En attente → Dossier en cours → En commande → SAV → Clôturé
4. Commentaires internes (non visibles dans le PDF)
5. PDF téléchargeable avec toutes les infos sauf commentaires internes

## Formulaire mobile (8 étapes)
1. Coordonnées intervention + facturation
2. Type d'installation (chaudière, clim, VMC, SDB, autre)
3. Dimensions des pièces + plans (calcul W/m³ automatique)
4. Urgence & description
5. Checklist dynamique selon le type
6. Photos
7. Notes vocales (MediaRecorder API)
8. Finalisation & envoi

## Accès
- Webapp /devis : admin, bureau, super_admin
- Mobile formulaire : admin toujours, ouvrier si can_create_devis = true
- Toggle dans Admin > Utilisateurs pour chaque ouvrier

## Responsive
- AppLayout : sidebar desktop, bottom nav mobile (admin/bureau)
- SuperAdminLayout : même approche responsive
- MobileLayout : onglet Devis conditionnel
