# Agenda mobile ouvrier — simplification et alertes fiches

## 1. Agenda jour uniquement
- Suppression des onglets "jour / semaine / mois" et des vues Semaine et Mois dans l'agenda mobile.
- Seule la vue Jour reste, avec navigation jour précédent / jour suivant.

## 2. En-tête compact
- Jour et date affichés sur une seule ligne horizontale (ex. "Mardi 18 août 2026") entre les flèches de navigation, pour gagner de la hauteur d'écran.

## 3. Bandeau rouge "Fiches à envoyer"
- Nouveau panneau rouge repliable placé au-dessus du panneau Mémos secrétariat.
- Contenu : toutes les tâches passées de l'ouvrier (tout l'historique, jusqu'à hier inclus) dont la fiche d'intervention/entretien n'est pas envoyée (aucune fiche, ou fiche encore en brouillon local/serveur).
- Chaque ligne : date, heure, titre, client ; clic → ouvre la tâche.
- Panneau masqué s'il n'y a rien en retard.
- Fiabilisation du statut "envoyé" : le statut de fiche est recalculé à chaque affichage à partir de la base (et du brouillon local) pour qu'une fiche envoyée reste marquée comme telle après navigation ou rafraîchissement.

## 4. Marqueur rouge sur la carte de tâche
- Nouveau badge rouge "Fiche à envoyer", au même format que les badges existants (Brouillon / Envoyé au bureau / Terminé), avec bordure gauche rouge sur la carte.
- Affiché sur les tâches dont la date est passée et dont la fiche n'est pas envoyée.

## 5. Détail de la tâche
- Vérification et complétion des infos utiles : téléphone (bouton Appeler déjà présent), email client, adresse complète avec code postal et ville, mémo secrétariat, matériel, contacts syndic/locataire, clés/codes, notes internes.

## 6. Mémos repliés par défaut
- Le panneau Mémos secrétariat s'ouvre fermé ; le nouveau panneau rouge est également fermé par défaut (compteur visible dans l'en-tête).

## Détails techniques
- `src/pages/mobile/MobileAgenda.tsx` : suppression de `ViewMode`, `WeekView`, `MonthView` et de la persistance de vue ; requête limitée au jour affiché + requête séparée des tâches passées non clôturées (fiche manquante ou `is_draft = true`) pour alimenter le bandeau rouge.
- Nouveau composant `src/components/mobile/FichesEnRetardPanel.tsx`, calqué sur `MemosSecretariatPanel`, en style destructif.
- `MemosSecretariatPanel.tsx` : état initial replié.
- Badge rouge : nouvelle classe `badge-sheet-late` dans `src/index.css`, alignée sur les classes `badge-sheet-*` existantes.
- `src/pages/mobile/MobileTaskDetail.tsx` : ajout de `postal_code`, `city` (client et site) et de l'email dans la requête et l'affichage.
- Aucun changement de base de données.
