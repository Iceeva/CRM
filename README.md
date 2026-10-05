# CRM Pro

Application web de **gestion de la relation client** : clients, prospects, opportunites commerciales, interactions, tableau de bord et un **assistant conversationnel** dote d'un moteur de reconnaissance d'intentions en francais.

Pile : **React 18** et **Tailwind** (frontend), **Express** et **Prisma** (backend), **Neon PostgreSQL** (base), **Vercel** (hebergement), **Bootstrap Icons** (icones), **OpenAI** et **Anthropic** (IA optionnelle).

> Fonctionne **sans aucune configuration** : sans base de donnees, l'application bascule sur un fichier JSON de demonstration. Neon, OpenAI et Anthropic sont des options.

---

## Sommaire

1. [Fonctionnalites](#1-fonctionnalites)
2. [Demarrage rapide](#2-demarrage-rapide)
3. [Architecture](#3-architecture)
4. [Structure du projet](#4-structure-du-projet)
5. [Configuration](#5-configuration)
6. [Base de donnees : Prisma et Neon](#6-base-de-donnees--prisma-et-neon)
7. [Chatbot assistant](#7-chatbot-assistant)
8. [IA optionnelle : OpenAI et Anthropic](#8-ia-optionnelle--openai-et-anthropic)
9. [Deploiement sur Vercel](#9-deploiement-sur-vercel)
10. [API REST](#10-api-rest)
11. [Interface et icones](#11-interface-et-icones)
12. [Tests](#12-tests)
13. [Securite](#13-securite)
14. [Scripts npm](#14-scripts-npm)
15. [Depannage](#15-depannage)
16. [Nouveautes de la version 2.0](#16-nouveautes-de-la-version-20)
17. [Documentation detaillee](#17-documentation-detaillee)

---

## 1. Fonctionnalites

| Domaine | Ce que vous pouvez faire |
|---|---|
| **Clients** | Creer, modifier, supprimer, rechercher, filtrer par statut, fiche detaillee avec interactions et opportunites |
| **Prospects** | Suivre le cycle `nouveau`, `contacte`, `converti` ; **conversion en client** en un clic (fiche client creee, historique journalise) |
| **Opportunites** | Pipeline en 6 etapes (prospection, qualification, proposition, negociation, gagnee, perdue), montants, date de cloture |
| **Interactions** | Appels, emails, reunions, notes, rattaches a un client ou un prospect |
| **Tableau de bord** | KPI, CA gagne, valeur du pipeline, taux de conversion, graphiques, dernieres activites |
| **Assistant** | Questions en langage naturel, actions avec confirmation, relances contextuelles, correction des fautes de frappe |
| **Authentification** | Inscription et connexion JWT, mots de passe haches (bcrypt), limitation des tentatives |
| **Stockage double** | Neon PostgreSQL via Prisma, avec **bascule automatique** sur JSON si la base est injoignable |
| **Deploiement** | Pret pour Vercel (fonction serverless + site statique) |

---

## 2. Demarrage rapide

### Prerequis

- **Node.js 18.18 ou plus recent** (`node -v`)
- npm 9 ou plus
- Optionnel : un compte [Neon](https://neon.tech) (base), un compte [Vercel](https://vercel.com) (hebergement), des cles OpenAI et/ou Anthropic (IA)

### Option A : mode JSON, zero configuration (2 minutes)

```bash
# 1. Dependances du backend (workspace) et generation du client Prisma
npm install

# 2. Dependances du frontend
npm --prefix frontend install

# 3. Terminal 1 : API sur http://localhost:5000
npm run dev:backend

# 4. Terminal 2 : interface sur http://localhost:3000
npm run dev:frontend
```

Connexion de demonstration : **`admin@crm.com`** / **`admin123`**.

Les donnees de demonstration (8 clients, 6 prospects, 10 opportunites, 10 interactions) sont lues et ecrites dans `backend/data/data.json`. Le bandeau de la barre laterale affiche "JSON (local)".

### Option B : avec Neon PostgreSQL

```bash
cp backend/.env.example backend/.env
# Editez backend/.env : DATABASE_URL (URL poolee), DIRECT_URL (URL directe), JWT_SECRET
npm install
npm run db:deploy        # cree les tables sur Neon
npm run db:seed          # donnees de demonstration
npm run dev:backend      # doit afficher : [stockage] Neon PostgreSQL (Prisma) connecte
```

Procedure complete, URL a utiliser et depannage : [docs/DATABASE.md](docs/DATABASE.md).

### Option C : activer l'IA (facultatif)

Dans `backend/.env` :

```env
AI_PROVIDER=anthropic          # ou openai, ou auto
ANTHROPIC_API_KEY=sk-ant-...   # et/ou OPENAI_API_KEY=sk-...
```

Redemarrez le backend. Details : [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md).

### Option D : deployer sur Vercel

Importez le depot sur Vercel (racine = racine du depot), ajoutez `JWT_SECRET` et `DATABASE_URL`, deployez. Guide : [docs/DEPLOYMENT_VERCEL.md](docs/DEPLOYMENT_VERCEL.md).

---

## 3. Architecture

```
Navigateur (React)
     |  /api/*  (axios, JWT)
     v
Express  (backend/src/app.js)          Vercel : api/index.js   |   Local : server.js
     |
     |-- middlewares : securite, CORS, limiteur de debit, JWT, validation
     |-- controllers : auth, clients, prospects, interactions, opportunites, dashboard, chatbot
     |-- chatbot     : NLP -> intentions -> dialogue -> handlers -> (IA optionnelle)
     v
storageService  (facade)
     |-- Neon PostgreSQL via Prisma   (si DATABASE_URL definie et base joignable)
     '-- Fichier JSON                 (secours automatique)
```

Details et decisions de conception : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

| Couche | Technologies |
|---|---|
| Frontend | React 18, React Router 6, Tailwind CSS 3, Recharts, Axios, react-hot-toast, **bootstrap-icons** |
| Backend | Node.js 18+, Express 4, JWT (jsonwebtoken), bcryptjs, morgan, cors, dotenv |
| Donnees | Prisma 6, PostgreSQL (Neon), fichier JSON de secours |
| Chatbot | Moteur NLP en JavaScript pur (aucune dependance), OpenAI et Anthropic via `fetch` |
| Hebergement | Vercel (fonction serverless et CDN) |
| Tests | `node:test` (aucune dependance de test) |

---

## 4. Structure du projet

```
crm/
|-- api/index.js                  Point d'entree serverless Vercel
|-- vercel.json                   Build, rewrites, cache, options de la fonction
|-- package.json                  Workspace racine, scripts Prisma et build
|-- scripts/                      prisma-generate.js, generate-intents-doc.js
|-- backend/
|   |-- .env.example              Toutes les variables, documentees
|   |-- prisma/                   schema.prisma, migrations/, seed.js
|   |-- data/data.json            Donnees de demo et stockage du mode JSON
|   |-- src/
|   |   |-- app.js / server.js    Application Express / demarrage local
|   |   |-- config/               env.js, prisma.js, jsonStore.js
|   |   |-- middlewares/          auth, validate, schemas, security, rateLimit, errorHandler
|   |   |-- controllers/          Un controleur par ressource, plus chatbot
|   |   |-- routes/               Declaration des routes
|   |   |-- services/             storageService.js (facade Neon / JSON)
|   |   |-- stores/               prismaStore, jsonCollectionStore, schema, normalize
|   |   |-- utils/                id, pagination, asyncHandler, httpError, pick
|   |   '-- chatbot/              nlp/, intents/, engine/, handlers/, llm/, service.js
|   '-- test/                     48 tests : NLP, 113 intentions, dialogues, IA simulee, API
|-- frontend/
|   |-- .env.example
|   '-- src/
|       |-- components/           Layout, ChatWidget, Icon, Modal, Pagination, SearchBar...
|       |-- pages/                Dashboard, Clients, Prospects, Opportunities, Interactions...
|       |-- context/              AuthContext.js
|       |-- services/             api.js, chatbot.js
|       '-- hooks/                useStorageStatus.jsx
'-- docs/                         Guides detailles (voir section 17)
```

Chaque dossier important contient son propre README : [backend](backend/README.md), [prisma](backend/prisma/README.md), [chatbot](backend/src/chatbot/README.md), [frontend](frontend/README.md).

---

## 5. Configuration

Toute la configuration passe par des **variables d'environnement**, lues en un seul endroit (`backend/src/config/env.js`). Le fichier modele `backend/.env.example` documente chacune d'elles.

| Groupe | Variables principales |
|---|---|
| Serveur | `PORT`, `NODE_ENV` |
| Base de donnees | `DATABASE_URL` (poolee), `DIRECT_URL` (directe), `DB_RECHECK_MS` |
| Authentification | `JWT_SECRET` (**obligatoire en production**), `JWT_EXPIRES_IN`, `BCRYPT_ROUNDS` |
| CORS | `CORS_ORIGINS` |
| Chatbot | `CHATBOT_ENABLED`, `CHATBOT_DEBUG`, `CHATBOT_PERSIST_HISTORY`, `CHATBOT_MIN_CONFIDENCE`, `CHATBOT_AMBIGUITY_MARGIN` |
| IA (optionnelle) | `AI_PROVIDER`, `AI_MODE`, `AI_FAILOVER`, `AI_TIMEOUT_MS`, `AI_MAX_TOKENS`, `AI_TEMPERATURE`, `AI_SHARE_CRM_DATA` |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` |
| Anthropic | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_VERSION` |
| Frontend | `REACT_APP_API_URL` (seulement si l'API est sur un autre domaine) |

Generer un secret JWT :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 6. Base de donnees : Prisma et Neon

- **Schema** : `backend/prisma/schema.prisma` (6 modeles : `User`, `Client`, `Prospect`, `Interaction`, `Opportunity`, `ChatMessage`), migration initiale incluse.
- **Neon** : `DATABASE_URL` utilise l'hote **poolee** (`-pooler`, indispensable en serverless), `DIRECT_URL` l'hote **direct** (migrations).
- **Bascule automatique** : si Neon est injoignable, les requetes sont servies par le JSON ; le frontend affiche le mode actif et previent lors d'un changement.
- **Relations** : supprimer un client supprime ses interactions et conserve ses opportunites (detachees) ; supprimer un prospect conserve l'historique.

Commandes (depuis la racine) :

```bash
npm run db:generate     # regenere le client Prisma
npm run db:migrate      # nouvelle migration (developpement)
npm run db:deploy       # applique les migrations (production)
npm run db:seed         # donnees de demonstration (idempotent)
npm run db:studio       # interface graphique
```

Guide complet : [docs/DATABASE.md](docs/DATABASE.md).

---

## 7. Chatbot assistant

Le bouton rond en bas a droite de l'interface ouvre l'assistant. Il comprend le francais courant, y compris les fautes de frappe et les abreviations.

### Exemples

| Vous ecrivez | L'assistant |
|---|---|
| "combien de clients actifs ?" puis "et les prospects ?" | Compte, puis reprend la meme question pour les prospects |
| "quel est l'email de marie dupond" puis "et son telephone ?" | Retrouve Marie Dupont malgre la faute, puis son numero |
| "chiffre d'affaires du mois dernier" | Calcule le CA sur la periode et liste les affaires gagnees |
| "opportunites de plus de 10k en negociation" | Filtre par montant et statut |
| "qui dois-je relancer ?" | Priorise prospects non contactes, affaires en retard, clients silencieux |
| "j'ai appele Nadia Benali hier" | Prepare l'interaction (type et date deduits), demande confirmation |
| "convertis Camille Moreau en client" | Resume l'action, attend "oui", execute, journalise |
| "supprime le client Lucas Bernard" | Avertit des consequences, demande confirmation |
| "ajoute un client" | Pose les questions manquantes une par une (nom, email) |

### Le moteur de reconnaissance d'intentions

- **30 intentions** : conversation, consultation, actions d'ecriture, navigation.
- **Pipeline** : normalisation (accents, argot SMS) -> racinisation -> extraction d'entites (type, statut, champ, noms, email, telephone, montant, date, periode, tri, pronom) -> classification sur 4 signaux -> dialogue -> handler.
- **Classifieur hybride** : similarite lexicale ponderee par l'IDF (tolerante aux fautes), mots-cles, patrons, coherence avec les entites. Score de **confiance** et detection d'**ambiguite** (question de precision avec reponses rapides).
- **Dialogue multi-tours** : remplissage d'informations manquantes, confirmation, choix entre candidats, annulation, changement de sujet, relances contextuelles.
- **Sans etat serveur** : l'etat de la conversation voyage dans chaque requete (compatible Vercel), assaini cote serveur.
- **Qualite** : 113 phrases de test inedites, precision exigee d'au moins 95 %.

Documentation technique complete : [docs/CHATBOT.md](docs/CHATBOT.md). Catalogue des intentions : [docs/INTENTS.md](docs/INTENTS.md).

---

## 8. IA optionnelle : OpenAI et Anthropic

Les deux fournisseurs sont **facultatifs**, activables seuls ou ensemble, avec bascule automatique :

| Configuration | Comportement |
|---|---|
| Aucune cle (defaut) | Moteur local uniquement |
| `AI_PROVIDER=openai` + cle | OpenAI pour les phrases non comprises et les questions hors CRM |
| `AI_PROVIDER=anthropic` + cle | Anthropic, meme logique |
| `AI_PROVIDER=auto` + 2 cles | Anthropic, puis OpenAI en secours, puis moteur local |
| `AI_MODE=assist` | En plus, reformulation naturelle des reponses du moteur local |
| `AI_MODE=off` | L'IA n'est jamais appelee |

Garanties :

- L'IA **ne peut jamais ecrire** dans le CRM : les actions passent uniquement par le moteur local, avec confirmation.
- Emails et telephones sont **masques** avant tout envoi ; les donnees nominatives du CRM ne sont envoyees que si `AI_SHARE_CRM_DATA=true`.
- Toute panne (cle invalide, quota, delai) est absorbee : le moteur local repond.
- Aucun SDK : appels `fetch` natifs. `OPENAI_BASE_URL` permet d'utiliser Azure OpenAI, OpenRouter, Ollama, LM Studio.

Guide : [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md).

---

## 9. Deploiement sur Vercel

1. Poussez le depot sur GitHub / GitLab / Bitbucket.
2. Importez-le sur [vercel.com/new](https://vercel.com/new) (racine du projet = racine du depot).
3. Variables d'environnement : `JWT_SECRET` (obligatoire), `DATABASE_URL` (URL poolee Neon), et au besoin `DIRECT_URL`, `AI_*`.
4. Deployez, puis initialisez la base une fois depuis votre poste : `npm run db:deploy && SEED_ADMIN_PASSWORD="..." npm run db:seed`.
5. Verifiez : `curl https://VOTRE-APP.vercel.app/api/health` doit renvoyer `"storageMode": "postgresql"`.

Le frontend est servi par le CDN, l'API par la fonction `api/index.js`, et les rewrites de `vercel.json` gerent `/api/*` et les routes React. Sans `DATABASE_URL`, le mode JSON utilise `/tmp` : **donnees ephemeres**. Guide complet : [docs/DEPLOYMENT_VERCEL.md](docs/DEPLOYMENT_VERCEL.md).

---

## 10. API REST

Base `/api`, JSON, authentification `Authorization: Bearer <jeton>`.

| Ressource | Routes |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Clients | `GET/POST /clients`, `GET/PUT/DELETE /clients/:id` |
| Prospects | `GET/POST /prospects`, `GET/PUT/DELETE /prospects/:id`, `POST /prospects/:id/convert` |
| Interactions | `GET/POST /interactions`, `GET/PUT/DELETE /interactions/:id` |
| Opportunites | `GET/POST /opportunities`, `GET/PUT/DELETE /opportunities/:id` |
| Tableau de bord | `GET /dashboard/stats`, `GET /dashboard/status` (publique) |
| Chatbot | `POST /chatbot/message`, `GET /chatbot/status`, `GET/DELETE /chatbot/history`, `POST /chatbot/analyze` (debug) |
| Sante | `GET /health` (publique) |

Listes : `?search=`, `?page=`, `?limit=` et filtres par ressource. Reference complete avec exemples : [docs/API.md](docs/API.md).

---

## 11. Interface et icones

Toutes les icones sont des **Bootstrap Icons** fournis par le paquet npm `bootstrap-icons` (aucun CDN, aucun emoji) :

```js
// frontend/src/index.js
import "bootstrap-icons/font/bootstrap-icons.css";
```

```jsx
import Icon from "../components/Icon";

<Icon name="people" />                       // <i class="bi bi-people"></i>
<Icon name="trash" title="Supprimer" />      // avec libelle d'accessibilite
```

Le composant `Icon` (`frontend/src/components/Icon.jsx`) masque l'icone aux lecteurs d'ecran sauf si un `title` est fourni, et `InteractionIcon` associe une icone a chaque type d'interaction. Catalogue : [icons.getbootstrap.com](https://icons.getbootstrap.com).

Interface responsive (menu lateral sur ordinateur, tiroir sur mobile, assistant plein ecran sur petit ecran).

---

## 12. Tests

```bash
npm test
```

| Fichier | Contenu |
|---|---|
| `chatbot.nlp.test.js` | Normalisation, racines, fautes de frappe, dates, periodes, montants, entites |
| `chatbot.intents.test.js` | 113 phrases inedites sur 30 intentions, hors sujet, niveaux de confiance |
| `chatbot.dialog.test.js` | 16 conversations completes (creation, conversion, suppression, ambiguite, etat falsifie) |
| `chatbot.ai.test.js` | OpenAI et Anthropic avec `fetch` simule : appel, masquage, basculement, repli local |
| `api.test.js` | API HTTP : JWT, validation, CRUD, tableau de bord, chatbot (necessite `npm install`) |

Aucun test n'appelle de service externe ni ne touche vos donnees : ils utilisent un fichier JSON temporaire.

---

## 13. Securite

| Mesure | Detail |
|---|---|
| Mots de passe | Haches avec bcrypt, jamais renvoyes par l'API |
| Jetons | JWT signes avec `JWT_SECRET` ; l'application **refuse de demarrer en production** sans secret |
| Inscription | Role impose a `user` : impossible de s'auto-attribuer `admin` |
| Force brute | 10 tentatives par 15 minutes sur la connexion et l'inscription |
| Validation | Schemas par ressource, liste blanche des champs ecrits, chaines nettoyees |
| En-tetes | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS en production |
| CORS | Origines explicites en production (`CORS_ORIGINS`) |
| Erreurs | Details techniques masques en production, `requestId` pour le support |
| Chatbot | Etat client assaini, confirmation obligatoire des ecritures, debug desactive en production |
| IA | Masquage des emails et telephones, partage de donnees opt-in, aucune ecriture possible |
| Secrets | `.env` ignore par git ; cles jamais exposees au frontend |

**A faire avant la mise en production** : definir un `JWT_SECRET` fort, changer ou supprimer le compte de demonstration `admin@crm.com` (`SEED_ADMIN_PASSWORD` au seed), utiliser Neon plutot que le mode JSON, renseigner `CORS_ORIGINS` si necessaire.

---

## 14. Scripts npm

Depuis la racine :

| Commande | Effet |
|---|---|
| `npm install` | Installe le backend (workspace) et genere le client Prisma |
| `npm run dev:backend` | API avec rechargement automatique (nodemon) |
| `npm run dev:frontend` | Interface React sur le port 3000 |
| `npm start` | API en mode production locale (sert aussi `frontend/build` s'il existe) |
| `npm run build` | Compile le frontend |
| `npm test` | Lance les tests |
| `npm run db:generate` / `db:migrate` / `db:deploy` / `db:push` / `db:seed` / `db:studio` | Prisma |
| `node scripts/generate-intents-doc.js` | Regenere `docs/INTENTS.md` |

---

## 15. Depannage

| Probleme | Solution |
|---|---|
| `Cannot find module 'express'` | `npm install` a la racine |
| Le bandeau indique "JSON (local)" alors que Neon est configure | Verifiez `DATABASE_URL` (voir [docs/DATABASE.md](docs/DATABASE.md)), puis `GET /api/health` |
| `JWT_SECRET est obligatoire en production` | Definissez `JWT_SECRET` |
| Les icones n'apparaissent pas | `npm --prefix frontend install` (paquet `bootstrap-icons`) puis relancez |
| Le chatbot repond "Je n'ai pas bien compris" | Reformulez ; verifiez avec `POST /api/chatbot/analyze` (`CHATBOT_DEBUG=true`) |
| Le chatbot n'utilise pas l'IA | `AI_PROVIDER` et la cle correspondante doivent etre definis (voir [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md)) |
| Port 5000 occupe (macOS) | `PORT=5001` dans `backend/.env` et adaptez le `proxy` de `frontend/package.json` |
| Donnees perdues sur Vercel | Mode JSON ephemere : configurez Neon |

Plus de cas : [base de donnees](docs/DATABASE.md#6-depannage), [Vercel](docs/DEPLOYMENT_VERCEL.md#6-depannage), [IA](docs/AI_PROVIDERS.md#7-depannage).

---

## 16. Nouveautes de la version 2.0

| Domaine | Avant | Maintenant |
|---|---|---|
| Base de donnees | Driver `pg` et SQL manuel | **Prisma** + **Neon**, migrations versionnees, seed idempotent |
| Hebergement | Serveur Node seul | **Vercel** : fonction serverless, site statique, rewrites |
| Assistant | Aucun | **Chatbot** avec moteur de 30 intentions, dialogue multi-tours, IA optionnelle |
| Icones | Emojis | **Bootstrap Icons** via paquet npm |
| Securite | Inscription avec role libre, validation minimale | Role impose, validation par schema, limiteur, en-tetes, secret obligatoire |
| Erreurs | Reponses heterogenes | Gestionnaire central, codes HTTP corrects |
| Code | Controleurs dupliques, `process.env` disperses | Configuration centralisee, facade de stockage, stores testables |
| Donnees | `maintenance` orpheline, dates de 2024 | Jeu de demonstration coherent en 2026 |
| Tests | Aucun | 48 tests automatises |
| Documentation | README court | README detaille et 7 guides |
| Dashboard | Totaux simples | Pipeline, taux de conversion, agregats SQL |

### Migrer depuis la version 1

| Ancien | Nouveau |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` dans `backend/.env` | Une seule URL `DATABASE_URL` (et `DIRECT_URL`) : voir [docs/DATABASE.md](docs/DATABASE.md) |
| `backend/schema.sql` | `backend/prisma/schema.prisma` et `backend/prisma/migrations/` |
| `npm run init-db` execute du SQL | `npm run init-db` applique les migrations Prisma et insere les donnees de demo |
| Tables creees a la main | `npm run db:deploy` |
| Dependances dans `backend/package.json` seulement | `npm install` **a la racine** (workspace), puis `npm --prefix frontend install` |

Les anciennes variables `DB_*` sont ignorees. Les routes et formats JSON de l'API existante sont inchanges : le frontend v1 reste compatible. Pour reprendre des donnees d'une base v1 existante, pointez `DATABASE_URL` vers cette base et lancez `npm run db:push` (verifiez d'abord les differences avec `npx prisma migrate diff`) ou importez-les dans une base Neon neuve avec `pg_dump` et `psql`.

---

## 17. Documentation detaillee

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Vue d'ensemble, arborescence, decisions de conception |
| [docs/DATABASE.md](docs/DATABASE.md) | Prisma, Neon, pooler, migrations, depannage |
| [docs/DEPLOYMENT_VERCEL.md](docs/DEPLOYMENT_VERCEL.md) | Deploiement pas a pas, variables, serverless |
| [docs/CHATBOT.md](docs/CHATBOT.md) | Moteur d'intentions en detail, dialogue, securite, extension |
| [docs/INTENTS.md](docs/INTENTS.md) | Catalogue genere des 30 intentions et de leurs informations |
| [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md) | OpenAI et Anthropic, modes, confidentialite |
| [docs/API.md](docs/API.md) | Reference de l'API REST et du chatbot |

---

## Licence

MIT. Voir le champ `license` de `package.json`.
