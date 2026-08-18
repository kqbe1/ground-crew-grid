# 10 — Checklist de migration et analyse des risques

## A. Ordre d'exécution recommandé

### Étape 0 — Préparation (avant toute action)
- [ ] Geler les développements fonctionnels sur le projet Lovable.
- [ ] Demander aux ouvriers de **finaliser et envoyer toutes leurs fiches en brouillon** (les brouillons sont en localStorage, liés au domaine — voir doc 11).
- [ ] Exporter les données : `pg_dump` complet (schéma + données) du projet source.
- [ ] Exporter le contenu des 4 buckets Storage.
- [ ] Noter la liste exhaustive des utilisateurs `auth.users` (12 comptes) et des 2 entreprises.
- [ ] Rassembler les nouveaux comptes : fournisseur d'e-mails, fournisseur IA, Firebase, registrar DNS, Vercel, GitHub.

### Étape 1 — Code sur GitHub
- [ ] Connecter le dépôt GitHub et pousser le code.
- [ ] Retirer `lovable-tagger` et les deux plugins `@lovable.dev/vite-plugin-*` (modifier `vite.config.ts` **avant** la désinstallation).
- [ ] Vérifier que `.env` est bien ignoré par Git.
- [ ] Créer `vercel.json` (réécritures SPA + en-têtes de cache).
- [ ] Vérifier que `npm install && npm run build` réussit en local.

### Étape 2 — Projet Supabase cible
- [ ] Créer le projet, choisir la région (Europe — RGPD).
- [ ] Activer les extensions : `pg_cron`, `pg_net`, `pgmq`, `vault`.
- [ ] Créer le schéma `private` et **toutes** ses fonctions SECURITY DEFINER.
- [ ] Créer les 26 tables + enums + index, avec les **GRANT explicites** (`authenticated`, `service_role`).
- [ ] Recréer les triggers (`handle_new_user`, `set_company_id`, `sync_user_role`, `restrict_user_profile_update`, `restrict_ouvrier_task_update`, `enforce_binomes_limit`, `update_updated_at_column`, triggers d'audit).
- [ ] Recréer les policies RLS, en intégrant les correctifs du doc 04 (§7).
- [ ] Créer les 4 buckets avec le bon caractère public/privé et leurs policies.

### Étape 3 — Données
- [ ] Migrer `auth.users` (les mots de passe hachés sont transférables via export Supabase ; sinon prévoir une réinitialisation pour les 12 comptes).
- [ ] Charger les données métier dans l'ordre des dépendances : `companies` → `profiles` → `user_roles` → `clients` → `client_sites` → `client_equipment` → `task_binomes`/`binomes` → `work_tasks` → `work_task_assignees` → `intervention_sheets` → `maintenance_schedules` → `parts_orders` → `quotes` → tables de configuration → `activity_logs`.
- [ ] ⚠️ **Désactiver temporairement les triggers d'audit** pendant l'import, sinon `activity_logs` sera pollué de milliers de fausses entrées.
- [ ] Transférer les fichiers Storage en conservant l'arborescence exacte des chemins.
- [ ] 🔴 **Réécrire les URLs stockées** : `UPDATE companies SET logo_url = replace(logo_url, '<ancienne-ref>', '<nouvelle-ref>')` et idem pour `pdf_settings.logo_url` — sinon tous les logos disparaissent des PDF et de l'interface.
- [ ] Vérifier les compteurs de lignes table par table contre l'inventaire du doc 03.

### Étape 4 — Backend et automatisations
- [ ] Déployer les edge functions à conserver.
- [ ] Réécrire `process-email-queue` avec le nouveau fournisseur d'e-mails.
- [ ] Réécrire la vérification de signature de `handle-email-suppression`.
- [ ] Réécrire `analyze-nameplate` avec la clé IA propre.
- [ ] Recréer le secret `email_queue_service_role_key` **dans le vault**.
- [ ] Recréer les fonctions SQL `email_queue_dispatch()` / `email_queue_wake()` avec la **nouvelle URL de projet**.
- [ ] Recréer les jobs cron : file d'e-mails, `send-entretien-reminders-daily`, `security-monitor-hourly` (ou l'abandonner, voir risques).
- [ ] Enregistrer tous les secrets backend (doc 05).
- [ ] Ajouter les tables concernées à la publication `supabase_realtime` et vérifier `REPLICA IDENTITY FULL`.

### Étape 5 — Auth
- [ ] Désactiver l'auto-inscription.
- [ ] Activer le contrôle HIBP des mots de passe.
- [ ] Configurer Site URL et Redirect URLs (provisoirement l'URL Vercel, puis le domaine final).
- [ ] Configurer les modèles d'e-mails d'authentification avec le nouveau domaine.

### Étape 6 — Frontend sur Vercel
- [ ] Importer le dépôt, preset Vite, sortie `dist`.
- [ ] Déclarer `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` (Production + Preview).
- [ ] Premier déploiement sur l'URL `*.vercel.app` et **recette complète** (section B).

### Étape 7 — Domaine
- [ ] Ajouter le domaine dans Vercel, configurer les DNS, attendre le certificat.
- [ ] Mettre à jour Site URL / Redirect URLs dans Supabase Auth.
- [ ] Configurer les DNS d'envoi d'e-mails (SPF, DKIM, DMARC) chez le nouveau fournisseur.
- [ ] Mettre à jour `capacitor.config.ts` et l'`appId` si l'app native est conservée.

### Étape 8 — Bascule et surveillance
- [ ] Basculer les utilisateurs, mettre le projet Lovable en lecture seule (ne **pas** le supprimer).
- [ ] Surveiller 7 jours : logs des edge functions, `email_send_log`, erreurs frontend.
- [ ] Conserver l'ancien projet **au minimum 30 jours** avant toute suppression.

## B. Recette manuelle obligatoire après migration

La couverture de tests automatiques étant quasi nulle (doc 11), cette recette est le seul filet de sécurité.

| # | Scénario | Rôle | Attendu |
|---|---|---|---|
| 1 | Connexion / déconnexion | les 4 rôles | Redirection correcte selon le rôle |
| 2 | Ouvrir une donnée d'une autre entreprise par URL | admin entreprise A | Aucune donnée affichée |
| 3 | Créer un utilisateur | admin | Compte créé et rattaché à la bonne entreprise |
| 4 | Créer un client + site + équipement | bureau | Enregistrements créés avec le bon `company_id` |
| 5 | Créer une tâche et l'assigner | bureau | Tâche visible dans l'agenda de l'ouvrier |
| 6 | Remplir et envoyer une fiche (avec photos + signature) | ouvrier | Fichiers présents dans le storage, fiche visible côté bureau |
| 7 | Couper le réseau en cours de saisie, le rétablir | ouvrier | Brouillon conservé puis synchronisé |
| 8 | Générer le PDF d'une fiche | bureau | Logo, photos et blocs configurés présents |
| 9 | Envoyer une fiche par e-mail à un client | bureau | E-mail reçu, `email_send_log` en `sent` |
| 10 | Rappel d'entretien automatique | — | Job cron exécuté, e-mail parti |
| 11 | Demander une pièce depuis le mobile | ouvrier | Notification temps réel côté bureau |
| 12 | Analyse d'une plaque signalétique par photo | ouvrier | Champs pré-remplis |
| 13 | Import CSV de clients | bureau | Lignes créées, doublons gérés |
| 14 | Configuration PDF et e-mails | admin | Modifications persistées et appliquées |
| 15 | Créer une entreprise et son premier admin | super admin | Isolation vérifiée avec le scénario 2 |
| 16 | Installation PWA sur Android et iOS | ouvrier | Installation et démarrage sur `/mobile` |

## C. Analyse des risques

| # | Risque | Probabilité | Impact | Prévention |
|---|---|---|---|---|
| 1 | **Envoi d'e-mails cassé** — `@lovable.dev/email-js` et l'infrastructure Mailgun/Lovable ne sont pas portables | Élevée | Élevé | Réécrire et **tester** `process-email-queue` sur le projet cible avant la bascule ; garder un envoi manuel de secours |
| 2 | **Logos et images cassés** — URLs publiques stockées en base contenant l'ancienne référence de projet | Élevée | Moyen | `UPDATE` de réécriture systématique + contrôle visuel (scénario 8) |
| 3 | **Automatisations silencieusement mortes** — cron et fonctions SQL avec URL codée en dur | Élevée | Élevé | Recréer explicitement chaque job ; vérifier `cron.job_run_details` après 24 h |
| 4 | **Secret `email_queue_service_role_key` oublié dans le vault** | Moyenne | Élevé | Étape dédiée en checklist ; test d'envoi immédiat |
| 5 | **Analyse IA de plaque cassée** — `LOVABLE_API_KEY` inexistante hors Lovable | Certaine | Moyen | Basculer sur une clé Gemini/OpenAI propre |
| 6 | **Perte des brouillons hors-ligne** au changement d'origine | Moyenne | Moyen | Faire vider les brouillons avant la bascule |
| 7 | **Comptes utilisateurs non migrables sans réinitialisation** de mot de passe | Moyenne | Moyen | Tester l'import des hachages ; sinon prévoir la communication et un écran `/reset-password` (aujourd'hui absent) |
| 8 | **Policy RLS oubliée** lors de la recréation → table exposée (les GRANT sont larges) | Moyenne | **Critique** | Utiliser `pg_dump` plutôt qu'une réécriture manuelle, puis exécuter le linter Supabase et le scénario 2 |
| 9 | **Push notifications toujours non fonctionnelles** — `FCM_SERVER_KEY` absent et API FCM legacy dépréciée | Élevée | Faible | Décider explicitement : abandonner ou reconstruire en FCM HTTP v1 |
| 10 | **Régression `activity_logs`** — l'insertion de login échoue depuis avril (doc 04) | Certaine (déjà présent) | Faible | Corriger pendant la migration |
| 11 | **Règles métier uniquement frontend** contournables (doc 08) | Moyenne | Moyen | Porter les règles critiques en contraintes base après stabilisation |
| 12 | **Absence de tests** → régression non détectée | Élevée | Moyen | Recette manuelle B **intégralement** exécutée avant la bascule |
| 13 | **404 au rafraîchissement** faute de réécriture SPA sur Vercel | Moyenne | Élevé | `vercel.json` (doc 11) |
| 14 | **Variables d'env absentes au build** — le client Supabase ne les contrôle pas | Moyenne | Élevé | Déclarer les variables avant le premier build ; ajouter une garde dans le code |

## D. Ce qui ne devra surtout pas être oublié

1. Le secret `email_queue_service_role_key` **dans le vault** (invisible dans la liste des secrets d'edge functions).
2. Les **URLs codées en dur dans le corps des fonctions SQL** `email_queue_dispatch()` et `email_queue_wake()`.
3. La **réécriture des `logo_url`** stockées en base.
4. Les **jobs pg_cron**, qui ne figurent dans aucun fichier de migration versionné.
5. La **délégation DNS du sous-domaine d'envoi d'e-mails**.
6. Les **policies Storage** (elles ne sont pas dans les migrations applicatives).
7. La **publication `supabase_realtime`** et `REPLICA IDENTITY FULL`.
8. Le retrait de `lovable-tagger` **dans `vite.config.ts` avant** la désinstallation du paquet.

## E. Verdict de préparation

Le projet est **techniquement prêt à migrer**, avec un frontend entièrement portable (aucune URL frontend codée en dur, `window.location.origin` partout) et une base de données bien structurée et correctement isolée.

Les trois chantiers réels ne sont pas dans le frontend mais dans l'infrastructure :
1. **E-mails** — remplacement complet du fournisseur (le plus lourd) ;
2. **IA** — remplacement de la passerelle ;
3. **Automatisations et URLs stockées** — recréation minutieuse.

Aucun élément bloquant n'a été identifié.
