## Modifications mobiles ouvrier

### 1. Récap mémos secrétariat (top de l'agenda mobile)
- Nouveau composant `MemosSecretariatPanel` placé en haut de `MobileAgenda.tsx`.
- Charge les `work_tasks` du jour assignées à l'ouvrier connecté ayant un `memo_secretariat` non vide.
- Affichage : bandeau repliable (ouvert par défaut s'il y a au moins 1 mémo), avec icône cloche + compteur. Chaque ligne = heure + titre tâche + mémo, cliquable pour ouvrir le détail.

### 2. Fiches d'intervention / entretien — Heures & Statut
- **Multi-sélection libre** des statuts (cases au lieu de boutons radio). Stocké sous forme de tableau dans une nouvelle colonne `work_status_details text[]` (l'ancienne `work_status_detail` reste pour compat, peuplée avec le premier statut).
- **Suppression** du champ libre « Commentaire éventuel » global.
- **Note par statut** : dès qu'un statut est coché, un input texte court apparaît sous celui-ci pour saisir une note spécifique. Stocké dans `work_status_notes jsonb` (`{ termine: "…", sav: "…" }`).
- Le `final_status` envoyé à la tâche prend la priorité : `piece_a_commander` > `sav` > `a_replanifier` > `termine` > `planifie`.

### 3. Suppression « Demander une pièce » dans la fiche d'intervention
- Retirer le bouton/section dans le flow de `MobileFicheInterventionForm` (et entretien si présent). La demande de pièces reste accessible depuis `MobilePieces`.

### 4. Photo dans la demande de pièce
- Dans le formulaire de création de demande de pièce (page `MobilePieces` / dialog `CreateOrderDialog` côté mobile), ajouter le composant `PhotoCapture` existant. Upload vers `intervention-photos` bucket, persistance dans `parts_orders.photos text[]` (nouvelle colonne).

### 5. Coordonnées d'intervention supprimées du mobile
- Retirer le step `CoordinatesStep` des deux flows mobiles (intervention + entretien). `TOTAL_STEPS` passe de 9 → 8 (intervention) et ajusté entretien.
- Le PDF (`generateFichePdf.ts`) continue de lire les coordonnées : fallback sur `clients` / `client_sites` quand `client_*_override` est null (déjà partiellement le cas). Vérifier que toutes les sections « Coordonnées intervention » et « Facturation » lisent client+site quand pas d'override.
- Nettoyage : champs `client_*_override` et `billing_*` restent en base pour les fiches existantes.

### 6. Brouillons de fiche — UX & libellé
- Le draft localStorage existe déjà (`fiche_draft:*`). Ajout :
  - Sur la liste des tâches mobile (`MobileAgenda` + détail tâche), un badge **« Brouillon »** orange si un draft existe pour cette `task_id`.
  - À l'ouverture d'une tâche avec draft existant, toast « Brouillon repris ».
  - Bouton « Supprimer le brouillon » dans le header du formulaire mobile.
- Aucune persistance serveur supplémentaire (déjà géré offline via `useOfflineDrafts`).

### 7. Visuel tâches terminées (bande verte)
- Dans `MobileAgenda` et toutes les cartes tâche mobile : si `final_status === 'termine'` ET fiche envoyée (`intervention_sheets` lié, `is_draft=false`), ajouter une **bande verte 4px à gauche** (`border-l-4 border-green-500`) et un check icône.
- Étendre aussi à la liste desktop des tâches pour cohérence.

### 8. Verrou édition fiche après envoi
- Côté UI : si une fiche envoyée existe pour la tâche, le mobile (ouvrier) affiche en lecture seule. Pas de bouton « modifier ».
- Côté RLS : restreindre `UPDATE` sur `intervention_sheets` quand `is_draft = false` aux rôles `admin` et `bureau` uniquement. L'ouvrier garde `UPDATE` tant que `is_draft = true`.

---

### Modifications base de données

```sql
-- 1. Multi-statuts + notes par statut
ALTER TABLE intervention_sheets
  ADD COLUMN work_status_details text[],
  ADD COLUMN work_status_notes jsonb DEFAULT '{}'::jsonb;

-- 2. Photos sur les demandes de pièces
ALTER TABLE parts_orders ADD COLUMN photos text[];

-- 3. Verrou édition fiches envoyées
DROP POLICY "<update existing>" ON intervention_sheets;
CREATE POLICY "Ouvrier édite ses brouillons"
  ON intervention_sheets FOR UPDATE TO authenticated
  USING (worker_id = auth.uid() AND is_draft = true)
  WITH CHECK (worker_id = auth.uid() AND is_draft = true);
CREATE POLICY "Bureau/Admin éditent toutes les fiches"
  ON intervention_sheets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'bureau'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'bureau'));
```

### Fichiers principaux touchés
- `src/pages/mobile/MobileAgenda.tsx` (+ nouveau `MemosSecretariatPanel.tsx`, bande verte, badge brouillon)
- `src/pages/mobile/MobileFicheInterventionForm.tsx` + `MobileFicheEntretienForm.tsx` (suppr step coordonnées, suppr « demander pièce »)
- `src/components/mobile/steps/HoursStatusStep.tsx` (multi-select + notes par statut)
- `src/pages/mobile/MobilePieces.tsx` (PhotoCapture)
- `src/lib/generateFichePdf.ts` (fallback coordonnées client/site)
- `src/components/planning/DraggableTaskCard.tsx` + listes tâches (bande verte)
- Migration SQL ci-dessus
