# Journal des modifications

## 2.0.0 - octobre 2026

### Ajoute
- **Prisma et Neon PostgreSQL** : schema de 6 modeles, migration initiale, seed idempotent, bascule automatique sur le JSON.
- **Compatibilite Vercel** : `api/index.js` (fonction serverless), `vercel.json`, build, rewrites, stockage JSON dans `/tmp`.
- **Chatbot assistant** : moteur de 30 intentions (NLP en JavaScript pur), extraction d'entites, dialogue multi-tours, resolution floue des references, historique.
- **IA optionnelle** : OpenAI et Anthropic (cles facultatives, bascule, masquage des donnees, aucun SDK).
- **Bootstrap Icons** via le paquet npm `bootstrap-icons`, composant `Icon`.
- Pipeline commercial et taux de conversion dans le tableau de bord.
- Middlewares de securite, limiteur de debit, gestion d'erreurs centralisee, validation par schema.
- 48 tests automatises, 7 guides de documentation, README par dossier.

### Modifie
- Inscription : le role est force a `user`.
- API : URL relative cote frontend (proxy local, meme origine sur Vercel).
- Dashboard : agregats calcules par la base.
- Donnees de demonstration enrichies et datees de 2026.

### Retire
- Driver `pg` direct et `schema.sql` (remplaces par Prisma).
- Emojis de l'interface (remplaces par des icones).
- Doublon `frontend/src/api/axios.js` (cle de jeton incoherente).
- Cle `maintenance` inutilisee dans `data.json`.

## 1.0.0

Version initiale : clients, prospects, opportunites, interactions, tableau de bord, authentification JWT, double stockage PostgreSQL / JSON.
