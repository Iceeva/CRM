# Architecture

## Vue d'ensemble

```
frontend/ (React 18, Tailwind, Bootstrap Icons)
   |  axios (/api)
   v
api/index.js  ------------------------------>  Vercel : fonction serverless
backend/src/server.js  --------------------->  Local : app.listen
   |
   v
backend/src/app.js  (Express : securite, CORS, limiteur, routes, erreurs)
   |
   +-- routes/ -> middlewares/ (auth JWT, validation) -> controllers/
   |                                                          |
   |                                              services/storageService.js
   |                                                 |                |
   |                                        stores/prismaStore   stores/jsonCollectionStore
   |                                                 |                |
   |                                      Neon PostgreSQL        data/data.json (ou /tmp)
   |
   +-- chatbot/ (moteur d'intentions) --> memes services de stockage
                |
                +--> llm/ (OpenAI, Anthropic : optionnels)
```

## Arborescence

```
crm/
  api/index.js                   Point d'entree serverless Vercel
  backend/
    prisma/                      schema.prisma, migrations/, seed.js
    data/data.json               Donnees de demonstration + stockage du mode JSON
    src/
      app.js, server.js          Application Express / demarrage local
      constants.js               Statuts et types partages
      config/                    env.js, prisma.js, jsonStore.js
      middlewares/               auth, validate, schemas, security, rateLimit, errorHandler
      controllers/               auth, clients, prospects, interactions, opportunities, dashboard, chatbot
      routes/                    Une route par ressource
      services/storageService.js Facade Neon / JSON
      stores/                    prismaStore, jsonCollectionStore, schema, normalize
      utils/                     id, pagination, asyncHandler, httpError, pick
      chatbot/                   nlp/, intents/, engine/, handlers/, llm/, service.js
      scripts/initDb.js          Migrations + seed
    test/                        Tests (NLP, intentions, dialogues, IA simulee, API)
  frontend/
    src/
      components/                Layout, ChatWidget, Icon, Modal, Pagination, SearchBar, ConfirmDialog
      pages/                     Dashboard, Clients, Prospects, Opportunities, Interactions, Login, Register...
      context/AuthContext.js     Session utilisateur
      services/                  api.js (axios), chatbot.js
      hooks/useStorageStatus.jsx Mode de stockage en direct
  docs/                          Guides detailles
  scripts/                       prisma-generate.js, generate-intents-doc.js
  vercel.json, package.json      Deploiement et workspace
```

## Decisions de conception

| Decision | Raison |
|---|---|
| **Facade de stockage** (`storageService`) avec deux moteurs de meme signature | Les controleurs et le chatbot ignorent Neon ou JSON ; la bascule est transparente |
| **Champs en `snake_case` dans Prisma** | JSON identique a l'ancienne API et au mode JSON, donc aucune modification du frontend |
| **`app.js` separe de `server.js`** | La meme application tourne en local (`listen`) et sur Vercel (handler exporte) ; elle est aussi testable sans reseau |
| **Configuration centralisee** (`config/env.js`) | Aucun `process.env` disperse ; validation au demarrage |
| **Validation declarative** (`middlewares/validate.js`) | Schemas lisibles, messages en francais, nettoyage des chaines |
| **Gestion d'erreurs centralisee** | Traduit les codes Prisma (P2002, P2003, P2025) en codes HTTP |
| **Role `user` impose a l'inscription** | Empeche l'auto-attribution du role `admin` (faille de l'ancienne version) |
| **Chatbot sans etat serveur** | Compatible serverless ; l'etat est assaini a chaque requete |
| **IA derriere une interface commune** (`llm/`) | OpenAI et Anthropic interchangeables, bascule automatique, jamais bloquant |
| **Limiteur de debit en memoire** | Protection simple sans service externe ; remplacable par Redis |
| **Aucun SDK d'IA** | `fetch` natif : bundle serverless leger |

## Flux d'une requete

1. `requestId` attribue un identifiant, `securityHeaders` ajoute les en-tetes, CORS et limiteur s'appliquent.
2. La route valide le JWT (`auth`) puis le corps (`validate` + `schemas`).
3. Le controleur appelle `storageService`, qui choisit Prisma ou JSON.
4. Toute erreur remonte a `errorHandler`, qui repond avec le bon code HTTP.

## Evolutions envisageables

- Store partage (Upstash Redis, Vercel KV) pour le limiteur de debit.
- Roles et permissions fines (la route `requireRole("admin")` est deja disponible).
- Export CSV, import de contacts, rappels par email.
- Recherche plein texte PostgreSQL (`pg_trgm`) a la place du filtre `contains`.
