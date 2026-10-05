# Base de donnees : Prisma et Neon PostgreSQL

Ce document explique comment le CRM stocke ses donnees, comment brancher une base **Neon** (PostgreSQL serverless) via **Prisma**, et comment fonctionne le mode de secours JSON.

## 1. Les deux modes de stockage

| Mode | Quand ? | Persistance | Usage conseille |
|---|---|---|---|
| **Neon PostgreSQL (Prisma)** | `DATABASE_URL` definie et base joignable | Durable | Production, Vercel |
| **JSON** | `DATABASE_URL` absente, ou Neon injoignable | Fichier `backend/data/data.json` (local) ou `/tmp` (Vercel, **ephemere**) | Demo, developpement hors ligne |

Le choix est automatique et transparent pour les controleurs et le chatbot (`backend/src/services/storageService.js`) :

1. Si `DATABASE_URL` est definie, le service teste la connexion (`SELECT 1`).
2. Si Neon repond, toutes les operations passent par Prisma.
3. Si une erreur de **connexion** survient (Neon en pause, reseau coupe), la base est marquee indisponible et l'operation est rejouee sur le JSON.
4. Un nouveau test est tente a la demande, au plus toutes les `DB_RECHECK_MS` millisecondes (15 s par defaut). Aucun `setInterval` n'est utilise en serverless.
5. Les erreurs **metier** (doublon, reference invalide, enregistrement introuvable) ne declenchent jamais la bascule : elles sont renvoyees au client avec le bon code HTTP.

> Attention : les deux stockages sont independants. Ce qui est ecrit pendant une bascule JSON n'est pas rejoue vers Neon. Le frontend affiche en permanence le mode actif (barre laterale et tableau de bord) pour que ce soit visible.

## 2. Schema

Le schema est dans `backend/prisma/schema.prisma`. Les champs gardent leur nom en `snake_case` afin que le JSON renvoye par l'API soit **identique** en mode Neon et en mode JSON.

```
User 1---n ChatMessage
Client 1---n Interaction        (suppression du client : interactions supprimees)
Client 1---n Opportunity        (suppression du client : opportunites conservees, client_id = null)
Prospect 1---n Interaction      (suppression du prospect : interactions conservees, prospect_id = null)
```

| Table | Role | Index |
|---|---|---|
| `users` | Comptes (hash bcrypt, role `admin` ou `user`) | `email` unique |
| `clients` | Clients (statut `actif` / `inactif`) | `email`, `statut`, `nom` |
| `prospects` | Prospects (`nouveau` / `contacte` / `converti`) | `statut`, `nom` |
| `interactions` | Appels, emails, reunions, notes | `client_id`, `prospect_id`, `type`, `date` |
| `opportunities` | Pipeline (`prospection` a `gagnee` / `perdue`) | `client_id`, `statut`, `date_cloture` |
| `chat_messages` | Historique du chatbot (intention, confiance, moteur) | `(user_id, created_at)`, `session_id` |

Les montants sont des `Decimal(15,2)` (jamais de flottants pour de l'argent). L'API les renvoie en nombres JavaScript.

## 3. Brancher Neon pas a pas

### 3.1 Creer la base

1. Creez un compte sur [neon.tech](https://neon.tech) et un nouveau **projet**.
2. Choisissez une region proche de vos fonctions Vercel (par exemple Francfort pour une audience europeenne).
3. Dans le tableau de bord du projet, ouvrez **Connect** : Neon affiche des chaines de connexion.

### 3.2 Les deux URL a recuperer

Neon propose deux types d'hotes pour la meme base :

| Variable | Hote | Utilise par | Pourquoi |
|---|---|---|---|
| `DATABASE_URL` | contient `-pooler` (PgBouncer) | l'application a l'execution | Les fonctions serverless ouvrent beaucoup de connexions courtes : le pooler les mutualise |
| `DIRECT_URL` | **sans** `-pooler` | la CLI Prisma (migrations) | Les migrations ont besoin d'une connexion directe |

Exemple (a adapter) :

```env
DATABASE_URL="postgresql://USER:PASSWORD@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://USER:PASSWORD@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```

- `sslmode=require` est obligatoire chez Neon.
- `pgbouncer=true` indique a Prisma de ne pas utiliser de requetes preparees nommees, incompatibles avec le mode transaction de PgBouncer.
- `connect_timeout=15` laisse le temps a Neon de reveiller un calcul en pause (premier appel apres inactivite).

Si vous utilisez l'integration Neon du Marketplace Vercel, elle fournit en general une URL poolee et une URL non poolee (les noms exacts varient) : copiez-les dans `DATABASE_URL` et `DIRECT_URL`.

### 3.3 Configurer, migrer, remplir

```bash
cp backend/.env.example backend/.env      # puis renseignez DATABASE_URL, DIRECT_URL, JWT_SECRET
npm install                               # installe tout et genere le client Prisma (postinstall)
npm run db:deploy                         # applique les migrations sur Neon
npm run db:seed                           # donnees de demonstration (idempotent)
```

Pour tout faire en une commande : `npm --prefix backend run init-db`.

Verification : `npm run dev:backend` doit afficher `[stockage] Neon PostgreSQL (Prisma) connecte`, et `GET /api/health` renvoie `"storageMode": "postgresql"`.

## 4. Commandes Prisma utiles

Toutes les commandes se lancent depuis la **racine** du depot.

| Commande | Effet |
|---|---|
| `npm run db:generate` | Regenere le client Prisma (apres modification du schema) |
| `npm run db:migrate` | Cree et applique une migration en developpement (`prisma migrate dev`) |
| `npm run db:deploy` | Applique les migrations existantes (production, CI) |
| `npm run db:push` | Synchronise le schema sans migration (prototypage) |
| `npm run db:seed` | Insere les donnees de demo ; `node backend/prisma/seed.js --reset` vide d'abord |
| `npm run db:studio` | Interface graphique Prisma Studio |

### Modifier le schema

1. Editez `backend/prisma/schema.prisma`.
2. `npm run db:migrate -- --name ma_modification` (cree un dossier dans `backend/prisma/migrations/`).
3. Mettez a jour `backend/src/stores/schema.js` si vous ajoutez une collection ou un champ filtrable (liste blanche de champs, recherche, cascade du mode JSON).
4. Committez le dossier de migration, puis `npm run db:deploy` en production.

## 5. Bonnes pratiques

- **Ne jamais committer `.env`** (deja dans `.gitignore`).
- Utilisez des mots de passe de base differents pour dev et production, ou mieux, des **branches Neon** (une branche par environnement).
- Sur Vercel, lancez les migrations depuis votre poste ou la CI, pas pendant le build, afin de garder un deploiement rapide et reversible.
- Neon met les bases inactives en veille : la premiere requete peut prendre une a deux secondes. C'est normal, `connect_timeout=15` couvre ce cas.
- Pour sauvegarder, utilisez la restauration a un instant donne de Neon (PITR) selon votre plan.

## 6. Depannage

| Symptome | Cause probable | Solution |
|---|---|---|
| `[stockage] Mode JSON (DATABASE_URL non definie)` | Variable absente | Renseignez `backend/.env` |
| `Neon injoignable, mode JSON de secours` | URL erronee, base en veille trop longue, reseau | Testez l'URL avec `psql`, augmentez `connect_timeout` |
| `Cannot find module '.prisma/client'` | Client non genere | `npm run db:generate` |
| `prepared statement "s0" already exists` | `pgbouncer=true` absent sur l'URL poolee | Ajoutez `&pgbouncer=true` |
| `P1001 Can't reach database server` pendant une migration | `DIRECT_URL` pointe vers l'hote poolee ou est incorrecte | Utilisez l'hote **sans** `-pooler` |
| `P3009 migrate found failed migrations` | Migration precedente interrompue | `npx prisma migrate resolve --schema backend/prisma/schema.prisma --rolled-back <nom>` |
| Les donnees ont disparu sur Vercel | Mode JSON (`/tmp` ephemere) | Configurez `DATABASE_URL` |
