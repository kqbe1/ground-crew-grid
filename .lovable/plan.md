# Entretiens — améliorations

## 1. Pré-remplissage automatique depuis le client
Dans le formulaire d'entretien, dès qu'un client est sélectionné :
- le premier site (site principal, sinon le premier de la liste) est sélectionné automatiquement ;
- si ce site n'a qu'un seul équipement, il est également présélectionné ;
- la périodicité continue d'être déduite des règles légales de la région du client.

Même logique appliquée aux autres formulaires de l'app qui demandent un client + adresse/site (création de tâche planning, commande de pièce) : sélection du site principal et report des coordonnées du client (adresse, code postal, ville, téléphone, email) dans les champs correspondants quand ils sont vides.

## 2. Bandeau "Attention ce mois-ci"
Sur la page Entretiens, le bloc "Alertes légales" devient :
- titre renommé "Attention ce mois-ci" ;
- replié par défaut, avec le nombre d'alertes visible ;
- s'ouvre au clic sous forme de liste cliquable (toutes les alertes, plus de coupure à 5).

## 3. Fiche d'entretien complète + bouton de planification
La page de détail d'un entretien affichera l'ensemble des informations disponibles :
- Client : nom, téléphones (principal et secondaire), email, adresse d'intervention, code postal/ville, région, contact syndic, contact locataire, codes/clés, notes internes — uniquement les champs remplis ;
- Site : nom, adresse complète, notes ;
- Équipement : nom, énergie, marque, modèle, périodicité, dernier/prochain entretien ;
- Entretien : type, périodicité, échéances, alerte légale, statut, notes.

Ajout d'un bouton "Planifier cet entretien" qui ouvre la création de tâche pré-remplie avec le client, le site, le type d'entretien et une date proposée (l'échéance), puis marque l'entretien comme planifié une fois la tâche créée.

Le même enrichissement est appliqué à la boîte de dialogue de détail utilisée depuis les listes.

## 4. Nouveau type "Entretien Boiler"
Ajout du type `entretien_boiler` :
- ajouté à la liste des types d'entretien (formulaire, filtres, statistiques, libellés et couleur de badge) ;
- disponible partout où les types d'entretien sont listés.

## Détails techniques
- Migration base de données : `ALTER TYPE intervention_type ADD VALUE 'entretien_boiler'` (dans une migration dédiée, la valeur d'enum devant être committée avant usage), et `ALTER TYPE energy_type ADD VALUE 'boiler'` pour la cohérence des équipements.
- `src/lib/constants.ts` : ajout du libellé, de la couleur (`badge-boiler`) et de l'entrée dans `ENTRETIEN_SUBTYPES`; ajout du style dans `src/index.css` si nécessaire.
- `CreateEditEntretienDialog.tsx` : auto-sélection du site (`is_primary` en priorité) et de l'équipement unique ; ajout de `entretien_boiler` dans `TYPE_TO_ENERGY`.
- `src/pages/Entretiens.tsx` : bloc alertes en `Collapsible` fermé par défaut, titre "Attention ce mois-ci".
- `src/pages/EntretienDetail.tsx` et `src/components/entretiens/EntretienDetailDialog.tsx` : élargir le `select` Supabase aux colonnes client (téléphones, email, adresses, syndic, locataire, notes) et site, puis afficher les champs non vides.
- Bouton "Planifier" : réutilise le dialogue de création de tâche existant avec des valeurs par défaut (client, type, date).
