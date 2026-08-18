# 00 — Synthèse et vue d'ensemble

> Dossier technique de référence produit **avant** migration Lovable → GitHub → Supabase → Vercel → domaine personnalisé.
> **Aucune modification n'a été apportée au code applicatif** : seuls les fichiers de ce dossier `docs/migration/` ont été créés.

## 1. Le projet en une page

**Nom** : PME Terrain (client de référence : AG Chauffage, Belgique).

**Objectif** : SaaS multi-entreprises de gestion des interventions terrain pour PME du chauffage et de la climatisation. Il couvre le planning, les fiches d'intervention, les entretiens réglementaires récurrents, les commandes de pièces et les devis d'installation.

**Périmètre volontairement exclu** : pas de facturation, pas de comptabilité, pas d'ERP.

**Deux interfaces distinctes dans une seule application** :
- une **webapp bureau** (desktop) pour les rôles admin et bureau ;
- une **PWA mobile** (`/mobile`, également empaquetable en application native via Capacitor) pour les ouvriers, conçue pour fonctionner hors ligne ;
- plus une **console super admin** (`/super-admin`) pour l'exploitant de la plateforme.

**Utilisateurs finaux** : administrateurs et secrétariat d'une PME, techniciens de terrain, et l'exploitant du SaaS.

**Volumétrie actuelle** : 2 entreprises, 12 comptes utilisateurs, 26 tables, 13 edge functions, 92 migrations SQL.

## 2. Architecture

```text
┌────────────────────────────────────────────────────────┐
│  Frontend — React 18 + Vite + TypeScript + Tailwind    │
│  ├─ Webapp bureau  (AppLayout)                          │
│  ├─ PWA mobile     (MobileLayout, hors ligne)           │
│  └─ Console SaaS   (SuperAdminLayout)                   │
└───────────────┬────────────────────────────────────────┘
                │ supabase-js (JWT)
┌───────────────▼────────────────────────────────────────┐
│  Supabase                                               │
│  ├─ Auth (e-mail/mot de passe, sans auto-inscription)   │
│  ├─ Postgres : 26 tables, RLS par company_id            │
│  │    + schéma private (fonctions SECURITY DEFINER)     │
│  ├─ Storage : 4 buckets                                 │
│  ├─ Realtime : notifications temps réel                 │
│  ├─ Edge Functions Deno : 13                            │
│  └─ pg_cron + pg_net + pgmq : file d'e-mails, rappels   │
└───────────────┬────────────────────────────────────────┘
                │
        Services externes : IA (passerelle Lovable),
        e-mails (infrastructure Lovable/Mailgun), FCM
```

## 3. Table des matières du dossier

| Document | Contenu |
|---|---|
| `00-synthese.md` | Ce document : vue d'ensemble et verdict |
| `01-roles-et-permissions.md` | Les 4 rôles, la chaîne d'isolation multi-entreprises |
| `02-ecrans.md` | Inventaire exhaustif des écrans, routes et dialogues |
| `03-base-de-donnees.md` | 26 tables, enums, triggers, volumétrie, ordre de transfert |
| `04-auth-rls-securite.md` | Authentification, sessions, RLS détaillée, risques |
| `05-env-secrets-urls.md` | Variables, secrets, URLs codées en dur |
| `06-backend-fonctions-automatisations.md` | Les 13 edge functions, cron, file d'e-mails |
| `07-stockage-emails-notifications.md` | Buckets, e-mails, realtime, push |
| `08-logique-metier.md` | Règles métier, du bouton jusqu'à la base |
| `09-verification-fonctionnelle.md` | Ce qui fonctionne réellement, ce qui est incomplet |
| `10-migration-checklist-risques.md` | Checklist chronologique, recette, risques |
| `11-build-dependances-deploiement.md` | Build, dépendances Lovable, PWA, Vercel |

## 4. Les trois points durs de la migration

1. **Les e-mails** 🔴 — toute la chaîne (envoi, templates, gestion des bounces, sous-domaine `notify.agchauffage.be` délégué aux nameservers de Lovable) repose sur l'infrastructure Lovable via les paquets propriétaires `@lovable.dev/email-js` et `@lovable.dev/webhooks-js`. C'est le chantier le plus lourd : il faut choisir un fournisseur (Resend, Postmark, Mailgun direct, SES), réécrire `process-email-queue` et `handle-email-suppression`, et refaire la configuration DNS.
2. **L'analyse IA des plaques signalétiques** 🔴 — dépend de `LOVABLE_API_KEY` et de `ai.gateway.lovable.dev`. Remplacement simple par une clé Gemini ou OpenAI propre.
3. **Les automatisations et les URLs stockées** 🟠 — les jobs pg_cron et les fonctions SQL `email_queue_*` contiennent l'URL du projet Supabase **en dur**, et les URLs publiques des logos sont **stockées en base**. Rien de difficile, mais facile à oublier — d'où la checklist du doc 10.

À l'inverse, **le frontend est entièrement portable** : aucune URL frontend codée en dur, `window.location.origin` est utilisé partout, et les seules dépendances Lovable sont trois plugins Vite actifs uniquement en développement.

## 5. Anomalies découvertes pendant l'audit

Ces points ne bloquent pas la migration mais méritent une décision explicite ; le détail est dans les documents indiqués.

| Constat | Gravité | Doc |
|---|---|---|
| Le journal des connexions ne s'écrit plus depuis le 2026-04-20 (policy durcie, `company_id` manquant dans l'insert) | Moyenne | 04 |
| Un ouvrier peut, en base, modifier une fiche déjà envoyée (le verrou est uniquement dans l'interface) | Moyenne | 04 |
| `anon` et `authenticated` disposent de GRANT larges sur toutes les tables ; seule la RLS protège | Moyenne | 04 |
| Un compte désactivé conserve un JWT valide (`is_active` non testé en base) | Moyenne | 04 |
| Aucun écran de réinitialisation de mot de passe | Moyenne | 04 |
| `MobileLayout` ne vérifie pas le rôle | Faible | 01 |
| Notifications push probablement inopérantes (`FCM_SERVER_KEY` absent, API FCM legacy dépréciée) | Faible | 07 |
| Fonction `security-monitor` sans journalisation depuis le 2026-06-11 malgré un cron actif | Faible | 04 |
| Tables et fonctions obsolètes à ne pas migrer | Faible | 03 |
| Couverture de tests quasi nulle | Moyenne | 11 |
| Incohérence niveaux techniciens (enum T0–T5 en base, T0–T20 dans l'interface) | Faible | 03 |

## 6. Verdict

**Le projet est prêt à être migré.** Aucun élément bloquant n'a été identifié. L'isolation multi-entreprises est réelle et appliquée en base de données, le frontend est portable sans modification, et la structure de données est saine.

L'effort réel porte sur l'infrastructure e-mail et sur la recréation méticuleuse des automatisations. La migration doit se dérouler **dans l'ordre du document 10**, avec la recette manuelle exécutée intégralement avant la bascule des utilisateurs — l'absence de tests automatiques ne laissant pas d'autre filet de sécurité.
