
## Objectif

Refondre la grille du planning bureau (vues Jour, Semaine, Mois) :
1. **Inverser les axes** : ouvriers en lignes (à gauche), heures en colonnes (en haut).
2. **Réordonner les ouvriers** par drag-and-drop vertical, avec ordre persisté en base par société.
3. **Sélection multi-créneaux** (cliquer-glisser vertical sur la ligne d'un ouvrier) pour créer une tâche avec durée pré-remplie.

## 1. Base de données

Ajouter une colonne `display_order` sur `profiles` pour ordonner les ouvriers dans le planning :

```sql
ALTER TABLE public.profiles
  ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

-- Initialiser l'ordre par nom dans chaque société
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY full_name) AS rn
  FROM public.profiles
)
UPDATE public.profiles p SET display_order = ranked.rn
FROM ranked WHERE ranked.id = p.id;
```

La policy existante `admin_update_company_profiles` couvre déjà la mise à jour de cette colonne par admin/bureau (id ≠ auth.uid()). Pour permettre à un admin/bureau de réordonner aussi sa propre carte, ajouter une policy ciblée :

```sql
CREATE POLICY "bureau_admin_update_own_display_order" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() AND is_admin_or_bureau())
WITH CHECK (id = auth.uid() AND is_admin_or_bureau());
```

(la policy `own_update` reste, elle bloque déjà `role/company_id/is_active/can_create_devis/worker_level` mais autorise `display_order`.)

## 2. Refonte de la grille (Jour / Semaine)

Nouvelle disposition (ouvriers à gauche, heures en haut) :

```text
            07:00  08:00  09:00  10:00 ...  17:00
[Avatar] Pierre  ┃░░░░┃    ┃████┃    ┃    ┃ ...
[Avatar] Marie   ┃    ┃████┃    ┃░░░░┃    ┃ ...
[Avatar] Lucas   ┃████┃    ┃    ┃    ┃████┃ ...
```

- 1 ligne fixe par ouvrier (hauteur ~80px), header sticky à gauche pour la colonne ouvriers.
- 11 colonnes horaires (7h–17h), largeur ~120px, divisées visuellement en 4 quart-d'heure.
- Header horaire sticky en haut.
- Tâches positionnées en `absolute` dans la ligne via `left = (heureDébut − 7h) * largeurHeure` et `width = durée * largeurHeure / 60`.
- Resize horizontal (poignée droite) au lieu de vertical.
- Drag & drop d'une tâche : déplacement libre entre lignes (ouvrier) et colonnes (heure).

Composants impactés :
- `src/pages/Planning.tsx` (vue Jour intégrée).
- `src/components/planning/WeekViewGrid.tsx` (vue Semaine).
- `src/components/planning/DraggableTaskCard.tsx` (resize → axe X, dimensions horizontales).

## 3. Réordonner les ouvriers (drag vertical)

- La colonne ouvriers de gauche devient une zone draggable : chaque ligne ouvrier est `draggable` avec un type différent (`workerId`).
- Drop sur une autre ligne ouvrier → swap des `display_order` entre les deux profils, puis `UPDATE profiles SET display_order = …` pour les lignes affectées.
- Distinction du payload drag : utiliser `e.dataTransfer.setData("workerId", id)` pour les ouvriers et garder `"taskId"` pour les tâches → pas de conflit.
- Indicateur visuel : ligne ciblée surlignée + curseur `grab`.
- Réservé aux rôles admin/bureau (le composant n'est utilisé que par eux).

## 4. Sélection multi-créneaux pour créer une tâche

Sur la ligne d'un ouvrier (vues Jour & Semaine) :
- `onPointerDown` sur un quart d'heure → mémoriser `{ workerId, startMinute }`.
- `onPointerMove` (bouton enfoncé) → calculer la plage en cours, afficher un overlay bleu translucide qui s'étire horizontalement.
- `onPointerUp` → calculer `start_time` et `duration_minutes` (multiple de 15, min 15), pré-remplir et ouvrir `CreateTaskDialog` via le state `clickContext` étendu (`{ hour, workerId, durationMinutes }`).
- Un simple clic (pas de drag) garde le comportement actuel : ouverture du dialog avec durée par défaut 60.

`CreateTaskDialog` accepte déjà `defaultHour`, `defaultWorkerId` ; on ajoute une prop `defaultDuration` qui initialise `durationMinutes`.

## 5. Vue Mois

Ordre des ouvriers : la vue Mois n'affiche pas de colonnes par ouvrier, mais les libellés des tâches dans chaque case du jour seront simplement triés par `display_order` de l'assigné (cohérence visuelle avec les autres vues). Pas de drag de réordonnancement nécessaire ici.

## 6. Récap fichiers touchés

- `supabase/migrations/<timestamp>_planning_display_order.sql` — colonne + policy.
- `src/pages/Planning.tsx` — refonte vue Jour, fetch trié `order("display_order")`, gestion drag d'ouvrier, sélection multi-créneaux, prop `defaultDuration`.
- `src/components/planning/WeekViewGrid.tsx` — même refonte pour la semaine.
- `src/components/planning/DraggableTaskCard.tsx` — resize horizontal, dimensions et positionnement basés sur l'axe X.
- `src/components/planning/CreateTaskDialog.tsx` — nouvelle prop `defaultDuration`.
- `src/components/planning/MonthViewCalendar.tsx` — tri des tâches par `display_order`.

## Notes

- Aucun impact sur les fiches d'intervention, devis, ouvriers mobiles : `display_order` est purement UI bureau.
- `worker_level` et autres champs sensibles restent verrouillés par la policy `own_update`.
- L'ordre initial = ordre alphabétique pour rester cohérent avec l'existant.
