# Améliorations Bureau + fiche urgente mobile

## 1. Rappels d'entretien automatiques par email

- Nouvel onglet **« Rappels entretien »** dans Admin :
  - délai d'envoi configurable (nombre de jours avant l'échéance, défaut 30) ;
  - activation/désactivation de l'envoi automatique ;
  - personnalisation du mail (objet, texte d'intro, signature, téléphone/email de contact) — réutilise le modèle `rappel-entretien` existant.
- Un traitement quotidien parcourt les entretiens dont l'échéance tombe dans le délai configuré :
  - client **avec email** → envoi automatique du mail + notification dans l'app (bandeau « Attention ce mois-ci ») ;
  - client **sans email** → uniquement la notification dans l'app.
- Anti-doublon : un seul envoi par entretien et par échéance, avec date d'envoi visible sur la fiche d'entretien.

## 2. Bouton Retour cohérent partout

- Le bouton Retour revient à l'écran précédent réel (dossier, liste, modale) et non plusieurs pages en arrière.
- Depuis une fiche/tâche/commande ouverte depuis un dossier, on retourne au dossier.
- Après une suppression, retour à la liste correspondante (et non à la page supprimée).

## 3. Commandes de pièces : infos client

- La fiche d'une commande affiche un bloc client complet : nom, adresse d'intervention (CP/ville), téléphones, email, contact locataire/syndic, coordonnées propriétaire, avec liens cliquables.

## 4. Plusieurs ouvriers par tâche / entretien

- Sélection multiple d'ouvriers (sans limite) dans le formulaire de tâche et dans le formulaire d'entretien.
- Les ouvriers assignés voient la tâche dans leur agenda mobile ; l'affichage planning/tâches/fiches liste tous les ouvriers assignés.
- Les binômes restent disponibles en parallèle.

## 5. Suppression de la région client

- Retrait du champ « Région » (Bruxelles/Wallonie/Flandre) du formulaire client, des listes, du détail, de l'export et de l'import CSV. Adresses, CP et ville inchangés.
- Les règles légales d'entretien restent configurées en interne dans l'onglet Admin (type d'installation + région interne + nombre d'années).

## 6. Coordonnées propriétaire

- Si un client (locataire) a un propriétaire lié, le nom, prénom et téléphone du propriétaire s'affichent dans le détail de la tâche (web et mobile) et dans la fiche d'intervention/entretien.

## 7. Navigation sidebar

- Nouvel ordre : Dashboard, Planning, Clients, **Fiches**, **Devis**, Entretiens, Commandes, Tâches, Dossiers, Temps, Admin.

## 8. Mobile : fiche d'intervention urgente

- Bouton « Nouvelle fiche » dans l'app ouvrier ouvrant le même formulaire, avec en première étape la sélection du client (et du site).
- À l'enregistrement, une tâche du jour est créée automatiquement et liée à la fiche, assignée à l'ouvrier, pour rester visible côté bureau dans le planning.

## Détails techniques

- Base : nouvelle table de liaison `work_task_assignees` (+ équivalent pour `maintenance_schedules`) avec RLS/GRANTs par `company_id` ; conservation temporaire de `assigned_to` pour compatibilité. Colonnes `last_reminder_sent_at` sur `maintenance_schedules`, réglages de rappel stockés dans `email_settings` / une table de paramètres entreprise. Suppression de `clients.region` et de l'enum `client_region` après nettoyage du code.
- Emails : cron quotidien → edge function de rappel réutilisant `send-transactional-email` et le template `rappel-entretien`.
- Navigation : passage de `navigate(-1)` à des retours explicites (`to`) sur `BackButton` + état `from` transmis lors de l'ouverture des détails depuis un dossier.
- Mobile : `MobileFicheRouter` accepte un mode « sans tâche » (sélection client → création tâche + fiche).
