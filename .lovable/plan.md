

# 🏗️ Planning, Interventions & Entretiens – PME Terrain

## Vue d'ensemble
Application SaaS complète pour PME du bâtiment/terrain (3-50 ouvriers), composée d'une **webapp admin/secrétariat** et d'une **PWA mobile ouvrier**, connectées à une base de données unique via Lovable Cloud (Supabase).

**Style visuel** : Interface colorée & intuitive avec codes couleur prononcés, badges visuels, lecture rapide d'un coup d'œil.

---

## 🔐 Authentification & Rôles (RBAC)

- **Connexion email/mot de passe** avec gestion de session
- **3 rôles** : Admin, Secrétariat, Ouvrier
- **Niveaux hiérarchiques ouvriers** : T0 / T1 / T2
- **Gestion des binômes** avec répartition en % du travail
- Accès conditionnel selon le rôle (l'ouvrier ne voit que ses tâches, le secrétariat n'accède pas aux paramètres critiques)

---

## 📅 WEBAPP — Module Planning (Vue Principale)

- **Grille horaire** : heures en vertical, ouvriers/binômes en horizontal
- **Navigation** : Jour / Semaine / Mois avec flèches de navigation
- **Filtres** : par ouvrier, binôme, domaine, type d'intervention, statut
- **Cartes de travail** : heure, durée, titre, client, localisation, badge couleur par type, indicateurs (message secrétariat, terminé, statut pièce)
- **Interactions** : drag & drop, redimensionnement durée, copier/coller, alerte chevauchement, clic pour créer/voir tâche
- **Mémo secrétariat** attachable aux tâches
- Colonne(s) optionnelle(s) pour calendriers externes (Google, Apple, Outlook — préparation future)

---

## 📊 WEBAPP — Dashboard (Accueil)

- **Pièces** : compteurs demandées / commandées / reçues
- **Clients** : à planifier, suite commande reçue
- **Entretiens** : ce mois, mois suivant, par type (gaz, mazout, pellets, clim, VMC)
- **Alertes légales** Belgique (1 / 2 / 3 ans)
- **Travaux en attente** avec raisons

---

## 🔧 WEBAPP — Module Entretiens

- **Liste globale** : client, adresse, type, appareil (marque/modèle), dernière date, prochaine échéance, périodicité, statut
- **Statistiques** : total annuel par type, total mensuel
- **Projections** : N+1, N+2, N+3 — anticipation de charge future

---

## 👥 WEBAPP — Module Clients

- Coordonnées complètes (intervention, facturation, syndic, locataire)
- Plusieurs adresses/sites par client
- Appareils installés : énergie, marque, modèle, périodicité entretien, prochaine date
- Notes internes (syndic, clés, codes)
- Date d'anniversaire client

---

## 📦 WEBAPP — Module Commandes / Pièces

- Liées à un client + un travail
- **Statuts** : Demandée → Commandée → Reçue → Clôturée
- Urgence indiquée par couleur
- **Automatisation** : quand une commande passe à "Reçue", suggestion automatique de créer une suite de travail liée au client + commande

---

## 📋 WEBAPP — Module Fiches d'Intervention

- Liste complète avec accès aux photos, signature client, historique
- Possibilité de renvoyer par email au client
- Templates de fiches par type d'intervention (configurables par l'admin)

---

## ⚙️ WEBAPP — Module Admin

- Statistiques globales (nombre d'entretiens annuels, projections)
- Gestion des ouvriers et niveaux T0/T1/T2
- Gestion des binômes
- Templates de fiches d'intervention
- Paramètres globaux de l'application

---

## 📱 PWA MOBILE — Ouvrier

### Accueil = Agenda
- Vue par défaut : **Jour** (colonne unique verticale)
- Possibilité : Semaine / Mois
- Cartes travail : heure, titre, client, adresse, message secrétariat, matériel à prévoir, badge type, statut

### Détail Tâche
- Informations complètes
- **Boutons 1-clic** : appeler client, ouvrir GPS
- Bouton principal : compléter la fiche d'intervention

### Fiche d'Intervention (Mobile)
- Formulaire selon template du type d'intervention
- Photos avant / après
- Heure arrivée / départ
- Description libre
- Statut final : Terminé / Pièce à commander
- **Signature CLIENT** obligatoire (ou case "Client absent")
- Bouton envoyer

### Mode Offline
- Sauvegarde locale en brouillon si pas de connexion
- Indicateur visuel clair "brouillon"
- Envoi automatique dès retour réseau

### Pièces (Mobile)
- Consultation des demandes liées
- Création demande en fin d'intervention
- Notification immédiate au bureau

---

## 🗄️ Base de données (Lovable Cloud / Supabase)

- Tables : users, user_roles, profiles, clients, client_sites, client_equipment, work_tasks, intervention_sheets, parts_orders, maintenance_schedules, task_templates, binomes
- RLS strict par rôle
- Stockage fichiers (photos, signatures) via Supabase Storage
- Logique offline avec sync automatique

---

## 🔗 Intégrations (futures)

- **Odoo** : synchronisation contacts — préparé mais implémenté ultérieurement
- **Calendriers externes** : Google/Apple/Outlook — colonnes prévues dans le planning

---

## 📋 Statuts officiels

**Travaux** : Planifié → Terminé / À replanifier / Pièce à commander

**Commandes** : Demandée → Commandée → Reçue → Clôturée

