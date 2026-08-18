# Dossier technique de migration Lovable → GitHub → Supabase → Vercel → domaine

Objectif : produire un audit écrit et exhaustif du projet **avant** toute migration. Aucun fichier applicatif ne sera modifié : la seule production est un ensemble de documents markdown dans `docs/migration/`.

## Ce qui sera produit

Un dossier `docs/migration/` contenant 10 documents (numérotés, lisibles indépendamment) :

1. `00-synthese.md` — vue d'ensemble, architecture, stack, services externes, résumé exécutif + tableau final « prêt / pas prêt pour la migration ».
2. `01-roles-et-permissions.md` — les 4 rôles (super_admin, admin, bureau, ouvrier) : objectif, permissions, données accessibles, actions, restrictions, écrans, différences ; chaîne Entreprise → utilisateurs → rôles → permissions → données ; vérification réelle de l'isolation `company_id`.
3. `02-ecrans.md` — inventaire exhaustif des ~40 routes/pages (web, mobile, super-admin) : route, rôles autorisés, objectif, actions, données lues/créées/modifiées/supprimées, tables, composants, règles métier.
4. `03-base-de-donnees.md` — les ~26 tables : colonnes, types, PK/FK, défauts, contraintes, index, enums, données sensibles, lien `company_id`, triggers associés ; ce qui est à recréer, à migrer, à recalculer, ou temporaire.
5. `04-auth-rls-securite.md` — flux de connexion, sessions, résolution du rôle, rattachement entreprise, inventaire complet des policies RLS et des GRANT, fonctions `security definer`, risques réels d'accès inter-entreprises (test par requête/URL manipulée), points à durcir.
6. `05-env-secrets-urls.md` — toutes les variables d'environnement (frontend/backend, publique/secrète, usage, à recréer) — sans jamais afficher de valeur secrète — et toutes les URLs codées en dur classées par type, avec impact du changement de domaine.
7. `06-backend-fonctions-automatisations.md` — les 13 edge functions : rôle, déclencheur, entrées/sorties, secrets, dépendances, verify_jwt, équivalent cible ; plus cron `pg_cron`, file d'emails `pgmq`, triggers Postgres, realtime, push notifications, webhooks entrants.
8. `07-stockage-emails-notifications.md` — les 4 buckets Storage (public/privé, upload, lecture via URLs signées, policies à recréer), le système d'email (domaine d'envoi, templates, désabonnement, suppression), les notifications Realtime et push FCM/Capacitor.
9. `08-logique-metier.md` — règles métier par domaine (planning, tâches, fiches, entretiens, commandes, devis, binômes, PDF, temps de travail), avec pour chacune la localisation d'exécution : UI → frontend → API → backend → base.
10. `09-verification-fonctionnelle.md` — section 21 : pour chaque fonctionnalité importante, parcours de bout en bout avec statut (🟢/🟠/🟡/🔴/⚪/❓), recherche explicite des mocks, TODO, tableaux statiques, boutons sans action, fonctions vides ; tableau final Fonctionnalité / Frontend / Backend / DB / Service externe / Fonctionnel / Problème.
11. `10-migration-checklist-risques.md` — configuration Vercel (framework, build, output, env, preview/prod, domaine, rewrites SPA), configuration GitHub, configuration Supabase (projet, SQL, RLS, Auth, Storage, functions, secrets, cron), changement de domaine (OAuth, redirect URLs, CORS, emails, webhooks), checklist chronologique en 10 étapes, tests de non-régression, et section **RISQUES DE MIGRATION** classés 🔴/🟠/🟡/🟢 avec cause, prévention et test.

## Méthode d'audit

- Lecture systématique du code : `src/pages`, `src/components`, `src/hooks`, `src/lib`, `src/integrations`, `supabase/functions`, les 92 migrations SQL, `vite.config.ts`, `capacitor.config.ts`, `index.html`, `package.json`, `supabase/config.toml`.
- Interrogation en lecture seule de la base réelle pour l'état effectif : policies RLS, GRANT, index, contraintes, triggers, jobs cron, buckets et policies Storage, configuration Auth. Les affirmations sur l'état courant seront issues de ces lectures, pas de suppositions.
- Vérification fonctionnelle : lecture des chaînes d'appel complètes (bouton → handler → requête → table), recherche ciblée des motifs de simulation (`TODO`, `mock`, tableaux constants, handlers vides), consultation des logs d'edge functions récents pour savoir lesquelles tournent réellement, et parcours navigateur sur le preview pour les flux clés lorsque c'est possible.
- Toute information non confirmée sera marquée **À VÉRIFIER** avec l'explication de ce qu'il faut contrôler.
- Aucune valeur de secret ne sera écrite : uniquement les noms de variables.

## Notes techniques

- Le travail sera découpé en sous-audits menés en parallèle (base/RLS, écrans, backend/automatisations, vérification fonctionnelle), puis consolidé.
- Aucun fichier source, aucune migration, aucune configuration et aucune donnée ne sera modifié ; seuls les fichiers `docs/migration/*.md` seront créés.
- Points déjà identifiés à documenter avec attention : le backend Supabase existe déjà et est en grande partie indépendant, mais les clés d'API, l'`.env`, le domaine d'envoi d'emails, la clé IA utilisée par l'analyse de plaque signalétique et les URLs de fonctions inscrites en dur dans des fonctions SQL sont liés à l'environnement Lovable actuel.
