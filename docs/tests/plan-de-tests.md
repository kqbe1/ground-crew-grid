# Plan de tests final (localhost)

À exécuter après `npm run build` puis `npm run dev`. Aucun déploiement Supabase requis
pour les tests front ; la migration `20260820120000_bureau_received_at.sql` doit être
appliquée avant de tester le bloc « Fiches Bureau ».

## 1. Authentification
- Connexion / déconnexion pour chaque rôle (super_admin, admin, bureau, ouvrier).
- Pas de déconnexion automatique après inactivité.
- Auto-inscription impossible.

## 2. Utilisateurs & rôles
- Création d'utilisateur : super_admin (toute entreprise), admin (la sienne), bureau (ouvriers seulement).
- Modification du mot de passe (min. 8 caractères, message d'erreur clair).
- Badges de rôle et labels techniciens (T0…) identiques entre Admin et Agenda.

## 3. Isolation company_id
- Un admin/bureau ne voit que les clients, tâches, fiches, commandes, paramètres PDF/e-mail de son entreprise.
- Le super_admin voit tout.

## 4. Planning & conflits horaires
- Création de tâche sans conflit : validation normale.
- Création avec chevauchement (ouvrier principal, second ou multi-ouvriers) : alerte listant tâches, horaires et ouvriers, bouton de validation désactivé.
- Bouton « Corriger l'horaire » : focus sur l'heure de début ; après correction, validation possible.
- Même comportement en modification depuis le détail de tâche.

## 5. Fiches
- Ouvrier : brouillon persistant, fiche envoyée verrouillée, bandeau vert, bouton « Nouvelle fiche » en haut à droite.
- Bureau : une fiche finalisée aujourd'hui à partir d'un brouillon d'hier apparaît dans « Reçues (24 h) ».
- Action Archiver : la fiche disparaît du dashboard et reste visible dans Fiches (filtre « Archivées »).
- Suppression avec code `AGDELETENOW`.

## 6. Commandes
- Demande de pièce depuis mobile (avec photo), liaison à une tâche, cycle demandée → commandée → reçue → clôturée sans retour en arrière.
- Passage automatique de la tâche en « à replanifier » à la réception.

## 7. Notifications
- Bureau : toast + cloche à la création d'une commande, d'un devis, à la réception de pièce.
- Ouvrier : toast sur nouvelle tâche assignée en principal **et** en second, et sur modification de tâche.
- Push natif (FCM) : nécessite le secret `FCM_SERVER_KEY` et une API FCM v1 valide (non fonctionnel actuellement).

## 8. E-mails
- Envoi manuel d'une fiche au client (sélection des champs PDF), statut `sent_to_client`.
- Rappel d'entretien automatique (cron quotidien 7 h) : un seul envoi par échéance.
- Erreurs enregistrées dans `email_logs`.
- Accents corrects dans les e-mails reçus.

## 9. Permissions
- Ouvrier : pas d'accès aux écrans admin/bureau, pas de modification des champs réservés au bureau.
- Bureau : pas de modification des comptes admin.

## 10. Dashboard
- Compteurs par filtre cohérents avec les listes.
- Export ZIP des fiches filtrées.

## 11. Mobile / responsive
- Agenda du jour, mémos secrétariat, fiches en retard.
- Mode hors ligne : brouillons locaux, badge de synchronisation, envoi au retour du réseau.
- Rendu correct 360 px, 768 px, 1280 px.

## 12. Capacitor
- `npx cap sync` sans erreur ; build APK uniquement après validation localhost.
