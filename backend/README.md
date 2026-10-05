# Backend CRM Pro

API REST **Express** avec stockage **Prisma / Neon PostgreSQL** (secours JSON) et le moteur du chatbot. Vue d'ensemble du projet : [README racine](../README.md).

## Demarrage

```bash
# depuis la racine du depot (le backend est un workspace npm)
npm install
cp backend/.env.example backend/.env     # facultatif : sans lui, mode JSON
npm run dev:backend                      # http://localhost:5000/api
```

Au demarrage, le serveur valide la configuration, teste Neon et affiche le mode de stockage :

```
[stockage] Neon PostgreSQL (Prisma) connecte          # DATABASE_URL valide
[stockage] Mode JSON (DATABASE_URL non definie)       # aucune base configuree
[stockage] Neon injoignable, mode JSON de secours     # base configuree mais en panne
```

## Dossiers

| Dossier | Contenu |
|---|---|
| `src/app.js` | Application Express exportable (utilisee par `server.js` et par `api/index.js` sur Vercel) |
| `src/server.js` | Demarrage local, arret propre (SIGINT / SIGTERM), test de sante periodique |
| `src/config/` | `env.js` (variables centralisees), `prisma.js` (client et etat de connexion), `jsonStore.js` (fichier JSON atomique) |
| `src/middlewares/` | `auth` (JWT, `requireRole`), `validate` + `schemas`, `security`, `rateLimit`, `errorHandler` |
| `src/controllers/` | Logique des routes ; `prospectsController.convertProspect` et `dashboardController.computeStats` sont reutilises par le chatbot |
| `src/routes/` | Declaration des routes et de leurs middlewares |
| `src/services/storageService.js` | Facade unique Neon / JSON |
| `src/stores/` | `prismaStore`, `jsonCollectionStore` (meme interface), `schema` (metadonnees), `normalize` |
| `src/chatbot/` | Moteur d'intentions : voir [son README](src/chatbot/README.md) |
| `prisma/` | Schema, migrations, seed : voir [son README](prisma/README.md) |
| `data/data.json` | Donnees de demonstration, et stockage du mode JSON |
| `test/` | 48 tests `node:test` |

## Ajouter une ressource

1. Modele dans `prisma/schema.prisma` puis `npm run db:migrate -- --name ma_ressource`.
2. Entree dans `src/stores/schema.js` (champs autorises, recherche, dates, nombres, references, cascade).
3. Schemas de validation dans `src/middlewares/schemas.js`.
4. Controleur et route (copiez `opportunitiesController.js` et `routes/opportunities.js`), montez la route dans `src/app.js`.
5. Si besoin, ajoutez `ma_ressource` a `COLLECTIONS` dans `src/config/jsonStore.js` et au jeu `data/data.json`.

Le store, la pagination, la recherche, la validation de references et la suppression en cascade du mode JSON sont alors fournis par la facade.

## Conventions

- Les controleurs sont fins : validation en amont (middlewares), acces aux donnees via `storageService`, erreurs levees avec `HttpError` et transmises par `asyncHandler`.
- Les champs de donnees sont en `snake_case` (identiques en base, en JSON et dans l'API).
- Aucun `process.env` en dehors de `config/env.js`.
- Messages utilisateur en francais, sans accents dans le code source.

## Tests

```bash
npm test      # depuis la racine ou backend/
```

Les tests ecrivent dans un fichier JSON temporaire et n'utilisent jamais le reseau.
