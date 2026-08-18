# 01 — Rôles, permissions et isolation multi-entreprises

## 1. Chaîne Entreprise → Utilisateur → Rôle → Permissions → Données

```text
auth.users (Supabase Auth)
    │  trigger on_auth_user_created → handle_new_user()
    ▼
public.profiles  (id = auth.users.id)
    ├── company_id  ──────────────────►  public.companies
    │      (NULL = super admin, accès global)
    └── role (app_role)  ──trigger sync_user_role()──►  public.user_roles (miroir)
           │
           ▼
   fonctions SECURITY DEFINER du schéma private
   (get_my_company_id, get_my_role, is_admin, is_bureau,
    is_ouvrier, is_admin_or_bureau, is_super_admin, …)
           │
           ▼
   Policies RLS de chaque table :  company_id = private.get_my_company_id()
                                   AND <condition de rôle>
           │
           ▼
   Données visibles / modifiables
```

Points clés :
- **Un utilisateur = un profil = une entreprise.** Il n'y a pas de multi-appartenance ; `profiles.company_id` est unique par utilisateur.
- **Un utilisateur = un rôle principal** (`profiles.role`). `user_roles` existe mais n'est qu'un miroir alimenté par trigger : **aucune décision de sécurité ne la consulte**.
- Le rattachement à l'entreprise est **fait par l'administrateur** via l'edge function `create-user` (jamais par l'utilisateur lui-même). L'auto-inscription est désactivée.
- Le `company_id` d'une nouvelle ligne est imposé côté serveur par le trigger `set_company_id()` et vérifié par le `WITH CHECK` des policies INSERT.

## 2. Les quatre rôles

### 2.1 `super_admin` (badge ambre)

| | |
|---|---|
| **Objectif** | Exploiter la plateforme SaaS : créer/gérer les entreprises clientes, superviser les utilisateurs, régler les paramètres globaux, consulter le journal d'audit. |
| **`company_id`** | `NULL` |
| **Permissions** | Accès total via `private.is_super_admin()` présent dans quasiment toutes les policies. Seul rôle pouvant écrire dans `companies` et `platform_settings`. |
| **Données accessibles** | Toutes les entreprises et toutes leurs données. |
| **Actions** | Créer / activer / désactiver / supprimer une entreprise, changer plan et quota `max_users`, créer et modifier des utilisateurs de n'importe quelle entreprise, lire le journal d'activité global, régler la fréquence du moniteur de sécurité. |
| **Restrictions** | Aucune restriction technique. |
| **Écrans** | `/super-admin`, `/super-admin/companies`, `/super-admin/users`, `/super-admin/settings`, `/super-admin/logs`. |
| **Différence clé** | Seul rôle avec vision inter-entreprises. Redirigé automatiquement depuis `/` vers `/super-admin`. |

### 2.2 `admin` (badge rouge)

| | |
|---|---|
| **Objectif** | Administrer une entreprise cliente : équipe, paramétrage, planning, données métier. |
| **Permissions** | Toutes les opérations CRUD métier sur le périmètre de son entreprise, plus : gestion des utilisateurs de l'entreprise (`admin_update_company_profiles`, `admin_manage_roles`), configuration PDF et e-mails, règles légales, binômes. |
| **Données accessibles** | Toutes les données dont `company_id = son entreprise`. |
| **Restrictions** | Ne peut pas modifier son propre rôle ni son propre statut actif (trigger `restrict_user_profile_update`). Ne peut pas modifier `is_active`, `role` ni `worker_level` d'un autre `admin`/`super_admin`. Ne peut pas déplacer un utilisateur d'entreprise (`company_id` figé par trigger). Ne peut pas attribuer les rôles `admin` ou `super_admin` via `user_roles`. |
| **Écrans** | Toute la webapp bureau, dont `/admin` (onglets Utilisateurs, Binômes, Modèles, Règles légales, Config PDF, Config e-mails, Statistiques) et `/temps-ouvriers`. |
| **Différence clé** | Seul rôle « entreprise » habilité à gérer les utilisateurs et le paramétrage. |

### 2.3 `bureau` (badge bleu)

| | |
|---|---|
| **Objectif** | Secrétariat / dispatch : planifier, suivre les interventions, gérer clients, entretiens, commandes de pièces, envoyer les fiches aux clients. |
| **Permissions** | Identiques à `admin` sur les données métier : la très grande majorité des policies utilisent `private.is_admin_or_bureau()` sans distinguer les deux. |
| **Différences réelles avec `admin`** | `bureau` n'est **pas** couvert par `admin_update_company_profiles` (modification des profils des collègues) ni par `admin_manage_roles` (attribution de rôles). En revanche `bureau` **peut** lire `user_roles` (`admin_view_roles` utilise `is_admin_or_secretariat`) et **peut** modifier la configuration PDF et e-mails, créer des règles légales et gérer les binômes. |
| **Restrictions** | Pas de gestion des comptes utilisateurs, pas d'accès à la console super admin. |
| **Écrans** | Mêmes écrans que `admin`, l'onglet Utilisateurs de `/admin` étant réservé à `admin`. **À VÉRIFIER** : le masquage de cet onglet est-il purement visuel ? Si un `bureau` atteint la fonction `create-user`, celle-ci doit refuser — voir doc 06. |

### 2.4 `ouvrier` (technicien mobile)

| | |
|---|---|
| **Objectif** | Exécuter les interventions sur le terrain depuis la PWA mobile. |
| **Permissions lecture** | Uniquement les tâches où il est `assigned_to`, `second_assigned_to` ou présent dans `work_task_assignees` (policy `company_select_work_tasks`). Fiches : uniquement celles dont il est `worker_id`. Commandes de pièces : uniquement celles dont il est `requested_by`. Clients : **pas d'accès direct** — la lecture passe par la fonction `public.get_my_clients_safe()` qui ne renvoie que les clients liés à ses propres tâches et un sous-ensemble de colonnes (pas de `notes_internal`, pas de `syndic_keys_codes`). |
| **Permissions écriture** | Créer une fiche dont il est `worker_id` ; modifier ses **brouillons** (`Ouvrier édite ses brouillons` : `is_draft = true`) ; mettre à jour ses tâches, mais le trigger `restrict_ouvrier_task_update()` **remet de force** les valeurs d'origine pour `memo_secretariat`, `assigned_to`, `second_assigned_to`, `binome_id`, `client_id`, `client_site_id`, `equipment_id`, `created_by`, `intervention_type`, `title`, `scheduled_date`, `start_time`, `duration_minutes`, `template_id`. En pratique il ne peut donc modifier que le **statut**, la description, `material_needed` et `wait_reason`. Créer une commande de pièce dont il est `requested_by`. Uploader photos et signatures dans son propre dossier storage (`<auth.uid()>/…`). |
| **Restrictions** | Aucun accès aux configurations, aux autres ouvriers, aux statistiques, à la suppression de quoi que ce soit. Devis uniquement si `profiles.can_create_devis = true`. |
| **Écrans** | `/mobile` (agenda), `/mobile/tache/:id`, `/mobile/fiche/*`, `/mobile/fiches`, `/mobile/pieces`, `/mobile/profil`, et `/mobile/devis/nouveau` si autorisé. |
| **Différence clé** | Seul rôle dont la visibilité est restreinte **à l'intérieur** de son entreprise (par affectation), et non seulement entre entreprises. |

## 3. Où les rôles sont appliqués

| Niveau | Mécanisme | Fiabilité |
|---|---|---|
| Routage | `AppLayout` redirige `ouvrier` → `/mobile` et `super_admin` → `/super-admin` ; `SuperAdminLayout` bloque tout rôle ≠ `super_admin` | Cosmétique — contournable |
| Affichage | Menus et boutons conditionnés par `role` (`AppSidebar`, `MobileLayout`) | Cosmétique |
| Base de données | Policies RLS + triggers `restrict_*` + fonctions `private.*` | **Réelle** — barrière effective |
| Edge functions | Vérification du JWT et du `company_id` de l'appelant dans `create-user` / `update-user` | Réelle (voir doc 06) |

⚠️ **Faiblesse identifiée** : `MobileLayout` ne vérifie **pas** le rôle — il exige seulement une session. Un `admin` ou un `bureau` peut donc ouvrir l'interface mobile ouvrier. Ce n'est pas une fuite de données (la RLS s'applique quand même), mais c'est un comportement à décider explicitement.

## 4. Isolation entre entreprises — verdict

**Oui, l'isolation est réelle et appliquée en base**, pas seulement dans l'interface :

- Les 26 tables ont RLS activée et au moins une policy.
- Toutes les tables métier portent `company_id` et le comparent à `private.get_my_company_id()`.
- Les `WITH CHECK` des INSERT empêchent d'écrire dans une autre entreprise.
- Le storage applique le même filtre via `private.storage_file_belongs_to_my_company()`.

Manipuler une URL (`/clients/<id-d-une-autre-entreprise>`) ou forger une requête PostgREST **ne donne pas accès aux données** : la ligne est simplement invisible.

Réserves à traiter (détail et remédiation dans le doc 04) :
1. Les rôles `anon` et `authenticated` disposent des privilèges `SELECT/INSERT/UPDATE/DELETE` sur **toutes** les tables `public`. Seule la RLS bloque. C'est fonctionnel mais sans défense en profondeur : une future table créée sans policy serait immédiatement exposée.
2. Le rôle est stocké sur `profiles` (et non exclusivement dans `user_roles`), protégé par un trigger. Toute policy d'UPDATE ajoutée par erreur sur `profiles` deviendrait un vecteur d'élévation de privilèges.
3. `MobileLayout` sans garde de rôle.
