# Correctif Bureau + Admin + isolation multi-entreprise

## 1. Entretiens absents de la fiche client
Cause confirmée : `src/pages/ClientDetail.tsx` ne charge que `clients`, `client_sites`, `client_equipment` et `work_tasks`. Aucune requête sur `maintenance_schedules` n'existe — l'entretien est bien en base mais n'est jamais lu.

Correction : ajouter une section « Entretiens » dans la fiche client qui charge les entretiens liés au client, à ses sites ou à ses équipements, avec type, périodicité, prochaine échéance, site et équipement, et lien vers le détail entretien. L'isolation reste assurée par les RLS existantes (aucun changement SQL).

## 2. « Valider et archiver » les fiches
- Migration : ajout d'une colonne booléenne `bureau_archived` sur `intervention_sheets`, défaut `false`, NOT NULL. Aucune donnée modifiée, comportement actuel préservé pour les fiches existantes. Aucun statut métier modifié, aucune logique temporelle.
- Dashboard bureau (`BureauDashboard.tsx`) : la requête exclut par défaut les fiches archivées.
- Détail fiche (`FicheDetail.tsx`) : bouton « Valider et archiver » (et action inverse « Désarchiver ») pour admin/bureau. Aucune suppression, photos/signature/PDF intacts.
- Onglet Fiches (`Fiches.tsx`) : les fiches archivées restent visibles, avec un badge « Archivée ».

## 3. Bouton « Nouvelle tâche » dans Fiches
Le bouton existe déjà en haut à droite via `CreateTaskDialog` dans `Fiches.tsx`. Vérification de sa visibilité/permissions ; aucun second formulaire ne sera créé.

## 4-5. Configuration PDF isolée par entreprise
Cause confirmée : `PdfSettingsTab.tsx` fait `select("*")` sur `pdf_settings` sans filtre `company_id`, et affiche « Configuration introuvable » dès qu'aucune ligne n'existe pour le type de document.

Correction :
- Lecture filtrée explicitement sur le `company_id` de l'utilisateur connecté + `document_type`.
- Si aucune configuration n'existe pour l'entreprise et un type de document, l'écran affiche un formulaire pré-rempli avec des valeurs neutres (« Nom de votre entreprise », « Adresse de votre entreprise », etc.) et un bouton de création — aucune écriture automatique sur les configurations existantes.
- Le logo affiché provient uniquement de la configuration de l'entreprise (actuellement la première ligne trouvée, toutes entreprises confondues).
- Placeholders neutres partout.
- Aucune migration d'UPDATE global ; aucune donnée AG Chauffage modifiée.

## 6-10. Emails : suppression des valeurs AG Chauffage par défaut
- `EmailSettingsTab.tsx` : `DEFAULTS` et placeholders deviennent génériques (« Votre fiche d'intervention », « Merci de votre confiance, », « Nom de votre entreprise », « info@votredomaine.be »). Lecture de `email_settings` filtrée sur le `company_id` de l'utilisateur. Le fallback d'écriture `info@agchauffage.be` est retiré.
- `src/lib/sendEmailAG.ts` : suppression du fallback `contactEmail = "info@agchauffage.be"`.
- Templates `fiche-intervention.tsx` et `rappel-entretien.tsx` : les valeurs par défaut « AG Chauffage » / `info@agchauffage.be` / « Votre fiche d'intervention AG Chauffage » deviennent neutres et alimentées par les données transmises.
- `send-email` : audit du chemin JWT → `profiles.company_id` → `company_email_settings` (déjà correct) ; vérification que les variables `DEFAULT_FROM_*` ne contiennent pas de coordonnées AG Chauffage.

## 11. Rappels automatiques d'entretien
`send-entretien-reminders` regroupe déjà les réglages par `company_id`, mais retombe sur une entrée « global » si l'entreprise n'a pas de configuration. Ce fallback inter-entreprises sera supprimé : sans configuration propre, l'entreprise utilise des valeurs neutres. La logique J-30 et le cron ne sont pas modifiés.

## 13-16. Préservation des données
Aucune migration de données. Seule migration : ajout de la colonne `bureau_archived`. Aucune ligne `pdf_settings` / `email_settings` / `company_email_settings` n'est écrasée. AG Chauffage conserve intégralement ses valeurs enregistrées.

## Vérification prévue
- Typecheck du projet.
- Requêtes de contrôle en base : entretiens par client, présence des fiches et de la nouvelle colonne, configurations PDF/email par entreprise (aucune perte).
- Parcours navigateur : fiche client (entretiens visibles), archivage d'une fiche, disparition du Dashboard bureau, persistance dans l'onglet Fiches avec photos/signature.
- À valider manuellement : envoi email réel pour deux entreprises distinctes (From/Reply-To), rappel automatique en conditions réelles.