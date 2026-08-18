# 04 — Authentification, autorisations et sécurité

## 1. Comment les utilisateurs se connectent

- Système : **Supabase Auth**, méthode **e-mail + mot de passe uniquement**. Aucun provider OAuth n'est configuré (aucun appel `signInWithOAuth` dans le code), aucun magic link, aucun SMS.
- Écran unique : `/auth` (`src/pages/Auth.tsx`) — formulaire de connexion seul. **Aucun formulaire d'inscription** n'est exposé : le texte indique explicitement « Les comptes sont créés par votre administrateur ».
- `useAuth().signUp()` existe encore dans `src/hooks/useAuth.tsx` mais **n'est appelé nulle part**. Code mort à supprimer après migration (il porte `emailRedirectTo: window.location.origin`).
- **Aucun écran de réinitialisation de mot de passe** (`/reset-password` absent, `resetPasswordForEmail` jamais appelé). Un utilisateur qui perd son mot de passe dépend aujourd'hui d'un administrateur via `update-user`. À décider lors de la migration.
- L'auto-inscription est désactivée côté Supabase Auth. **À VÉRIFIER** dans les réglages Auth du nouveau projet : `disable_signup = true`, confirmation d'e-mail, et politique de mot de passe (activation du contrôle HIBP recommandée).

## 2. Gestion des sessions

Client : `src/integrations/supabase/client.ts`
```ts
createClient(URL, PUBLISHABLE_KEY, {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true }
})
```
- Session persistée en **localStorage** (choix cohérent avec la PWA/Capacitor, mais exposée au XSS — pas de cookie httpOnly).
- `AuthProvider` (`src/hooks/useAuth.tsx`) enregistre `onAuthStateChange` **avant** l'appel initial `getSession()`, ce qui est correct.
- Maintien de session volontaire : sur `visibilitychange`, `online` et `focus`, l'app rappelle `startAutoRefresh()` + `getSession()` pour éviter la déconnexion après inactivité (demande métier explicite).
- Une erreur réseau lors de la récupération du profil **ne déconnecte pas** l'utilisateur (3 tentatives avec backoff, puis conservation de la session).
- Déconnexions forcées : profil `is_active = false` ou entreprise `is_active = false` → `signOut()` + `alert()`.
- À la déconnexion, `purgeAllDrafts()` efface les brouillons localStorage.

⚠️ Le contrôle « compte désactivé » est fait **côté client**. Un utilisateur désactivé conserve un JWT valide jusqu'à son expiration et la RLS ne teste pas `is_active`. **Recommandation migration** : ajouter `is_active` aux conditions des fonctions `private.*` (ex. `get_my_company_id()` renvoyant NULL si inactif), ce qui coupe l'accès en base.

## 3. Détermination du rôle

- Le rôle vient **exclusivement de la base** : `profiles.role`, lu par `fetchUserData()`.
- Le code refuse explicitement de faire confiance à `user_metadata` pour le rôle (commentaire et `setRole(null)` dans `applySessionFallback`). Bonne pratique respectée.
- Côté base : `private.get_my_role()` (SECURITY DEFINER, `search_path = public`) lit `profiles.role` pour `auth.uid()`.
- `user_roles` est une **table miroir** maintenue par le trigger `sync_user_role()` ; elle n'intervient dans aucune décision d'autorisation.

## 4. Rattachement à l'entreprise

- `profiles.company_id`, positionné à la création par l'edge function `create-user` (qui force le `company_id` de l'appelant) ou par un super admin.
- `private.get_my_company_id()` est la fonction pivot utilisée par **toutes** les policies métier.
- Un `company_id` présent dans `user_metadata` est utilisé uniquement comme **valeur d'affichage de repli** en cas d'échec de lecture du profil ; il n'ouvre aucun droit.

## 5. Inventaire des règles RLS

RLS activée sur les 26 tables de `public`. Fonctions d'appui (schéma `private`, toutes `SECURITY DEFINER` avec `search_path` fixé) : `get_my_company_id`, `get_my_role`, `get_my_profile_protected`, `has_role`, `is_admin`, `is_bureau`, `is_ouvrier`, `is_admin_or_bureau`, `is_admin_or_secretariat`, `is_super_admin`, `is_task_assignee`, `can_create_devis_db`, `storage_file_belongs_to_my_company`, `list_security_definer_violations`, `apply_security_monitor_schedule`.

### 5.1 Motif standard (clients, client_sites, client_equipment, maintenance_schedules, task_templates, pdf_settings, binomes)
```sql
SELECT : company_id = private.get_my_company_id() OR private.is_super_admin()
INSERT : (company_id = private.get_my_company_id() AND private.is_admin_or_bureau()) OR private.is_super_admin()
UPDATE : company_id = private.get_my_company_id() AND (private.is_admin_or_bureau() OR private.is_super_admin())
DELETE : idem UPDATE
```
⚠️ Détail à corriger : plusieurs policies UPDATE n'ont **pas** de clause `WITH CHECK`. En PostgreSQL, `USING` sert alors aussi de `WITH CHECK` pour ces policies, donc le comportement reste sûr ici, mais l'explicite est préférable.

### 5.2 Tables à logique spécifique

**`work_tasks`**
- SELECT/UPDATE : `company_id` correct **ET** (`is_admin_or_bureau()` OU `assigned_to = auth.uid()` OU `second_assigned_to = auth.uid()` OU `private.is_task_assignee(id)`) OU super admin.
- INSERT : admin/bureau, ou l'ouvrier pour lui-même (`assigned_to = auth.uid() AND created_by = auth.uid()`).
- DELETE : admin/bureau uniquement.
- Trigger `restrict_ouvrier_task_update()` : verrouille les champs de planification pour les ouvriers.

**`intervention_sheets`** (6 policies)
- SELECT : même entreprise ET (admin/bureau OU `worker_id = auth.uid()`).
- INSERT : même entreprise ET (admin/bureau OU `worker_id = auth.uid()`).
- UPDATE : trois policies cumulées — `company_update_sheets` (admin/bureau ou propriétaire), `Bureau et Admin éditent toutes les fiches`, `Ouvrier édite ses brouillons` (`is_ouvrier() AND worker_id = auth.uid() AND is_draft = true`).
- ⚠️ `company_update_sheets` autorise un ouvrier à modifier **une fiche déjà envoyée** dont il est le `worker_id` (elle n'exige pas `is_draft`). Le verrouillage après envoi est donc appliqué **seulement dans l'interface**. **À corriger** : restreindre `company_update_sheets` aux admin/bureau, la policy brouillon couvrant déjà les ouvriers.
- DELETE : admin/bureau uniquement (le code `AGDELETENOW` est une confirmation d'interface, pas une règle base).

**`parts_orders`**
- SELECT : admin/bureau, ou `requested_by = auth.uid()`.
- INSERT : même entreprise avec `requested_by = auth.uid()`, ou admin/bureau.
- UPDATE / DELETE : admin/bureau uniquement → l'ouvrier ne peut pas modifier sa demande après coup.

**`profiles`** (6 policies)
- SELECT : `own_view` (`id = auth.uid()`, rôle `public`) + `company_view_profiles` (même entreprise ou super admin).
- UPDATE : `own_update` avec un `WITH CHECK` qui **compare `role`, `company_id` et `is_active` à leurs valeurs actuelles** via `private.get_my_profile_protected()` → toute tentative d'auto-promotion est rejetée ; `admin_update_company_profiles` (admin, même entreprise, pas soi-même) ; `bureau_admin_update_own_display_order` ; `sa_update_profiles`.
- INSERT et DELETE : aucune policy → refusés (création par trigger auth, suppression par `service_role`).
- Défense supplémentaire : trigger `restrict_user_profile_update()`.

**`user_roles`** : lecture de son propre rôle, lecture par admin/bureau pour les membres de l'entreprise, écriture par admin **sauf** sur soi-même et **sauf** les rôles `admin`/`super_admin`, tout par super admin.

**`companies`** : lecture du seul enregistrement de son entreprise (`member_view_company`), écriture réservée au super admin. Rappel : `authenticated` n'a pas le GRANT `SELECT`, la lecture passe par `public.get_my_company_full()`.

**`quotes`** : SELECT admin/bureau ou créateur ; INSERT admin/bureau ou (créateur ET `private.can_create_devis_db()`) ; UPDATE/DELETE admin/bureau ; tout pour super admin.

**`platform_settings`** : super admin exclusivement (4 policies).

**Tables e-mail techniques** (`email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`) : policies basées sur `auth.role() = 'service_role'`. Aucune lecture possible depuis le navigateur. `activity_logs` et `suppressed_emails` interdisent UPDATE et DELETE (journal immuable).

**`activity_logs`** : SELECT admin/bureau sur son entreprise, ou super admin. INSERT limité à l'événement `login` de soi-même (`action='login' AND actor_id=auth.uid() AND company_id = get_my_company_id()`), plus INSERT super admin. 🔴 **Régression confirmée par les données** : l'`insert` de login effectué dans `useAuth.tsx` n'envoie pas `company_id`, et `activity_logs` ne possède pas de trigger `set_company_id()`. Le `WITH CHECK` exige `company_id IS NOT NULL AND company_id = private.get_my_company_id()` : l'insertion est donc **rejetée**, silencieusement (le résultat n'est pas attendu par le code). Vérification en base : 211 lignes `login`, **toutes avec `company_id` NULL**, et **plus aucune depuis le 2026-04-20** — date à laquelle la policy a été durcie. La traçabilité des connexions est donc cassée aujourd'hui. Correctif : ajouter `company_id: profile.company_id` dans l'insert, ou ajouter le trigger `set_company_id` sur `activity_logs`.

Autre observation : 905 lignes `security_scan_clean` (bruit du moniteur de sécurité horaire), dont la dernière date du **2026-06-11** alors que le cron `security-monitor-hourly` est toujours actif → la fonction `security-monitor` ne journalise plus. **À VÉRIFIER** (logs de l'edge function) avant de la reconduire telle quelle.

**`push_tokens`** : chacun gère uniquement ses propres jetons (`auth.uid() = user_id`).

## 6. RLS sur le Storage

4 buckets, policies détaillées dans le doc 07. Principe : chemin préfixé par `<auth.uid()>/` pour l'écriture, lecture élargie aux admin/bureau de la même entreprise via `private.storage_file_belongs_to_my_company(name)`.
⚠️ `company-assets` est un bucket **public** au sens Supabase (URL publique devinable) alors que sa policy `SELECT` est restreinte : pour un bucket public, la policy ne protège pas l'accès direct par URL. Acceptable pour des logos, à confirmer qu'aucun autre contenu n'y est déposé.

## 7. Risques de sécurité actuels

| # | Risque | Gravité | Détail | Remédiation |
|---|---|---|---|---|
| 1 | GRANT trop larges | 🟠 | `anon` et `authenticated` ont `SELECT/INSERT/UPDATE/DELETE` sur **toutes** les tables `public`. Seule la RLS bloque `anon` (aucune policy ne le cible). | `REVOKE ALL ... FROM anon;` puis GRANT ciblés. À faire dans la migration SQL du nouveau projet. |
| 2 | Fiche envoyée modifiable par l'ouvrier | 🟠 | `company_update_sheets` n'exige pas `is_draft`. | Restreindre la policy aux admin/bureau. |
| 3 | Rôle stocké sur `profiles` | 🟠 | Protégé par trigger + WITH CHECK, mais fragile à toute future policy d'UPDATE. | Basculer les décisions sur `user_roles` + `has_role()`, ou conserver et documenter le trigger comme non modifiable. |
| 4 | Compte désactivé toujours porteur d'un JWT valide | 🟠 | `is_active` n'est vérifié que côté client. | Tester `is_active` dans `private.get_my_company_id()` / `get_my_role()`. |
| 5 | Session en localStorage | 🟡 | Vulnérable au XSS ; choix imposé par la PWA. | CSP stricte, dépendances à jour. |
| 6 | Pas de réinitialisation de mot de passe | 🟡 | Dépendance opérationnelle à l'administrateur. | Ajouter `/reset-password` après migration. |
| 7 | `MobileLayout` sans garde de rôle | 🟡 | Un admin/bureau peut ouvrir l'UI ouvrier. | Ajouter un contrôle de rôle explicite. |
| 8 | Verrous métier uniquement en frontend | 🟡 | Code `AGDELETENOW`, obligation de lier une commande à une tâche, limite d'utilisateurs `max_users`. | Porter les règles critiques en base (contraintes/triggers). |
| 9 | `email_settings` avec valeurs par défaut AG Chauffage | 🟢/🟡 | Fuite de branding entre tenants, pas de données. | Neutraliser les défauts. |

## 8. Un utilisateur peut-il accéder aux données d'une autre entreprise ?

**Non, pas via l'interface ni via une requête PostgREST forgée** : toutes les policies contraignent `company_id = private.get_my_company_id()`, et cette valeur est dérivée du JWT, jamais d'un paramètre client. Modifier une URL affiche une page vide, pas les données d'autrui.

Les vecteurs résiduels sont :
- une **future table sans policy** (les GRANT larges la rendraient immédiatement lisible) ;
- une **edge function** appelant Supabase avec la `service_role` sans re-vérifier le `company_id` de l'appelant (à contrôler fonction par fonction, voir doc 06) ;
- la **fuite de la clé `service_role`** (jamais présente côté client aujourd'hui — vérifié : aucune occurrence dans `src/`).

## 9. Ce qu'il faudra créer/modifier dans le Supabase cible

1. Recréer schéma `private` + toutes ses fonctions **avant** les policies.
2. Recréer les 26 tables avec leurs GRANT **explicites** (`authenticated` + `service_role`, `anon` uniquement si nécessaire — ici jamais).
3. Rejouer l'ensemble des policies (idéalement via `pg_dump`).
4. Recréer les triggers de sécurité : `restrict_user_profile_update`, `restrict_ouvrier_task_update`, `set_company_id`, `sync_user_role`, `handle_new_user`, `enforce_binomes_limit`.
5. Recréer les policies Storage et les 4 buckets avec le bon caractère public/privé.
6. Configurer Auth : signup désactivé, confirmation d'e-mail, HIBP, URL de site et redirections pointant vers le **nouveau domaine**.
7. Appliquer les correctifs 1 à 4 du tableau des risques — c'est le bon moment.
