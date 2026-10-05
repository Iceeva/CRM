# Deploiement sur Vercel

Le projet est prevu pour un deploiement **sans configuration manuelle** : le frontend React est servi comme site statique et l'API Express tourne dans **une seule fonction serverless**.

## 1. Comment ca marche

```
Navigateur
   |
   |  /            -> fichiers statiques de frontend/build   (CDN Vercel)
   |  /clients/42  -> index.html  (rewrite SPA)
   |  /api/...     -> fonction serverless api/index.js
   |                         |
   |                         +--> backend/src/app.js (Express)
   |                                  |
   |                                  +--> Prisma --> Neon PostgreSQL (URL poolee)
   |                                  +--> OpenAI / Anthropic (optionnel)
```

Fichiers concernes :

| Fichier | Role |
|---|---|
| `vercel.json` | Commande de build, dossier de sortie, rewrites `/api/*` et SPA, en-tetes de cache, options de la fonction |
| `api/index.js` | Point d'entree serverless : exporte l'application Express (aucun `listen`) |
| `package.json` (racine) | Workspace `backend`, scripts `vercel-build` et Prisma |
| `scripts/prisma-generate.js` | Genere le client Prisma pendant l'installation (tolerant aux erreurs) |
| `backend/prisma/schema.prisma` | `binaryTargets` incluant `rhel-openssl-3.0.x` (runtime Vercel) |

`vercel-build` : genere le client Prisma, installe les dependances du frontend puis lance `react-scripts build` avec `CI=false` (les avertissements ESLint ne font pas echouer le build).

## 2. Variables d'environnement

Dans **Project Settings > Environment Variables** :

| Variable | Obligatoire | Description |
|---|---|---|
| `JWT_SECRET` | **Oui** | Secret de signature des jetons. Sans lui, l'API refuse de demarrer en production. Generez-en un : `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DATABASE_URL` | Fortement conseille | URL **poolee** Neon (`-pooler`, `pgbouncer=true`). Sans elle : mode JSON ephemere |
| `DIRECT_URL` | Pour les migrations | URL directe Neon. Necessaire si vous lancez `prisma migrate` depuis Vercel |
| `CORS_ORIGINS` | Non | Seulement si une autre origine appelle l'API |
| `AI_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`... | Non | IA optionnelle, voir [AI_PROVIDERS.md](AI_PROVIDERS.md) |
| `CHATBOT_*` | Non | Reglages du chatbot, voir `backend/.env.example` |

Toutes les variables possibles sont documentees dans `backend/.env.example`.

## 3. Procedure

### Option A : interface Vercel (recommandee)

1. Poussez le depot sur GitHub, GitLab ou Bitbucket.
2. Sur [vercel.com/new](https://vercel.com/new), importez le depot. **Racine du projet : la racine du depot** (pas `frontend`).
3. Laissez les reglages detectes : `vercel.json` impose la commande de build et le dossier de sortie.
4. Ajoutez les variables d'environnement ci-dessus (au minimum `JWT_SECRET` et `DATABASE_URL`).
5. Deployez.
6. Depuis votre poste, initialisez la base Neon (une seule fois) :
   ```bash
   cp backend/.env.example backend/.env   # DATABASE_URL + DIRECT_URL de Neon
   npm install
   npm run db:deploy
   SEED_ADMIN_PASSWORD="un-mot-de-passe-solide" npm run db:seed
   ```

### Option B : ligne de commande

```bash
npm i -g vercel
vercel link
vercel env add JWT_SECRET
vercel env add DATABASE_URL
vercel --prod
```

## 4. Verifier le deploiement

```bash
curl https://VOTRE-APP.vercel.app/api/health
```

Reponse attendue :

```json
{ "status": "ok", "storageMode": "postgresql", "database": { "configured": true, "connected": true } }
```

Puis connectez-vous, ouvrez l'assistant (bouton en bas a droite) et demandez "combien de clients actifs ?".

## 5. Particularites du serverless

| Sujet | Comportement |
|---|---|
| **Disque** | Lecture seule hors `/tmp`. Le mode JSON ecrit dans `/tmp/crm-data.json`, **perdu** a chaque nouvelle instance. Utilisez Neon. |
| **Connexions** | Prisma est un singleton par instance (`globalThis`) et passe par le pooler Neon. |
| **Etat du chatbot** | Aucune memoire serveur : l'etat de dialogue voyage dans chaque requete/reponse, donc n'importe quelle instance peut repondre. |
| **Limiteur de debit** | En memoire, donc "par instance". Suffisant contre les abus simples ; pour un plafond global, branchez Upstash Redis ou Vercel KV (`middlewares/rateLimit.js`). |
| **Duree maximale** | 30 s (`functions.maxDuration` dans `vercel.json`). Le delai maximal des appels IA est de 15 s (`AI_TIMEOUT_MS`). |
| **Demarrage a froid** | Premiere requete un peu plus lente (chargement de Prisma, reveil de Neon). |
| **Region** | Pour reduire la latence, ajoutez `"regions": ["fra1"]` dans `vercel.json` pour la placer pres de votre base Neon. |

## 6. Depannage

| Symptome | Cause probable | Solution |
|---|---|---|
| Erreur 500 des le premier appel, log `JWT_SECRET est obligatoire` | Variable manquante | Ajoutez `JWT_SECRET` puis redeployez |
| `/api/...` renvoie la page d'accueil | Rewrite absent (projet deploye depuis `frontend/`) | Racine du projet = racine du depot |
| `Cannot find module '.prisma/client'` | Client non genere | Verifiez que `npm install` et `vercel-build` passent ; `binaryTargets` inclut `rhel-openssl-3.0.x` |
| Build en echec sur des avertissements ESLint | `CI=true` | `vercel-build` force `CI=false` |
| Le mode affiche "JSON" en production | `DATABASE_URL` absente ou Neon injoignable | Verifiez la variable et `GET /api/health` |
| CORS bloque les appels | Frontend et API sur des domaines differents | Renseignez `CORS_ORIGINS` et `REACT_APP_API_URL` |
| Le chatbot ne repond pas par l'IA | Cle absente ou `AI_PROVIDER=none` | Voir [AI_PROVIDERS.md](AI_PROVIDERS.md) ; le moteur local reste actif |
