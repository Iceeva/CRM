# Reference de l'API REST

Base : `/api` (local : `http://localhost:5000/api`). Format : JSON. Authentification : en-tete `Authorization: Bearer <jeton>` sur toutes les routes sauf celles marquees "publique".

## Conventions

| Sujet | Regle |
|---|---|
| Identifiants | Chaines (UUID v4 pour les nouveaux enregistrements) |
| Dates | ISO 8601 ; `date_cloture` au format `YYYY-MM-DD` |
| Montants | Nombres (decimaux Neon convertis) |
| Pagination | `?page=1&limit=20` ; reponse `{ data, total, page, totalPages }` |
| Recherche | `?search=texte` (insensible a la casse, sur les champs textuels de la ressource) |
| Erreurs | `{ "error": "message", "errors": [{ "field", "message" }]?, "requestId" }` |
| Codes | 400 validation, 401 non authentifie, 403 droits, 404 introuvable, 409 doublon, 413 corps trop gros, 429 trop de requetes, 500 erreur serveur |
| En-tetes utiles | `X-Request-Id` (support), `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` (429) |

Limites de debit : 300 requetes par minute et par IP sur `/api`, 10 tentatives par 15 minutes sur `/auth/register` et `/auth/login`, 40 messages par minute sur le chatbot.

## Authentification

| Methode | Route | Corps | Reponse |
|---|---|---|---|
| POST | `/auth/register` | `{ nom, email, password (6+) }` | 201 `{ token, user }` - role toujours `user` |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | - | Utilisateur courant (sans mot de passe) |

Le jeton expire apres `JWT_EXPIRES_IN` (7 jours par defaut).

## Clients `/clients`

| Methode | Route | Description |
|---|---|---|
| GET | `/clients?search=&statut=&page=&limit=` | Liste paginee |
| GET | `/clients/:id` | Detail |
| POST | `/clients` | `{ nom*, email*, telephone, entreprise, statut (actif/inactif), notes }` |
| PUT | `/clients/:id` | Mise a jour partielle |
| DELETE | `/clients/:id` | Supprime le client **et ses interactions** ; ses opportunites sont conservees (detachees) |

## Prospects `/prospects`

| Methode | Route | Description |
|---|---|---|
| GET | `/prospects?search=&statut=&page=&limit=` | Liste (`statut` : nouveau, contacte, converti) |
| GET / POST / PUT / DELETE | `/prospects[/:id]` | CRUD ; a la creation le statut est `nouveau` |
| POST | `/prospects/:id/convert` | Cree le client, passe le prospect en `converti`, journalise une note. 409 si deja converti |

## Interactions `/interactions`

| Methode | Route | Description |
|---|---|---|
| GET | `/interactions?client_id=&prospect_id=&type=&search=` | Liste, plus recentes d'abord (limite par defaut 50) |
| POST | `/interactions` | `{ type* (appel/email/reunion/note), sujet*, contenu, date, client_id ou prospect_id* }` |
| GET / PUT / DELETE | `/interactions/:id` | |

## Opportunites `/opportunities`

| Methode | Route | Description |
|---|---|---|
| GET | `/opportunities?client_id=&statut=&search=` | `statut` : prospection, qualification, proposition, negociation, gagnee, perdue |
| POST | `/opportunities` | `{ titre*, montant (>= 0), statut, description, date_cloture, client_id }` |
| GET / PUT / DELETE | `/opportunities/:id` | |

## Tableau de bord `/dashboard`

| Methode | Route | Description |
|---|---|---|
| GET | `/dashboard/stats` | Totaux, repartitions par statut, CA gagne, valeur du pipeline ouvert, taux de conversion, derniers elements, `storageMode` |
| GET | `/dashboard/status` | **Publique.** `{ storageMode: "postgresql" \| "json", database }` (sans detail d'erreur) |

## Sante

`GET /api/health` (publique) : `{ status, version, storageMode, database, uptime, timestamp }`.

## Chatbot `/chatbot`

| Methode | Route | Description |
|---|---|---|
| POST | `/chatbot/message` | Envoie un message (voir ci-dessous) |
| GET | `/chatbot/status` | `{ enabled, intents, minConfidence, persistHistory, ai }` (`ai` : fournisseurs actifs, jamais de cle) |
| GET | `/chatbot/history?sessionId=` | Messages d'une session |
| DELETE | `/chatbot/history` | Efface toutes les conversations de l'utilisateur |
| POST | `/chatbot/analyze` | Debug du moteur (`CHATBOT_DEBUG=true` seulement), voir [CHATBOT.md](CHATBOT.md) |

### `POST /chatbot/message`

Requete :

```json
{
  "message": "quel est l'email de Marie Dupont ?",
  "sessionId": "s-abc12345",
  "state": { "turns": 1, "lastIntent": "count_records", "pending": null }
}
```

- `message` : 1 a 2000 caracteres (obligatoire).
- `sessionId` : facultatif, genere par le serveur s'il est absent ; a renvoyer ensuite.
- `state` : l'objet `state` de la **reponse precedente** (absent au premier message). Il est assaini cote serveur.

Reponse :

```json
{
  "reply": "L'email de Marie Dupont est marie@acme.com.",
  "items": [{ "id": "cli-001", "title": "Marie Dupont", "subtitle": "ACME Corp - marie@acme.com", "badge": "actif", "to": "/clients/cli-001" }],
  "actions": [{ "type": "navigate", "to": "/clients/cli-001", "label": "Ouvrir la fiche", "auto": false }],
  "quickReplies": ["Voir sa fiche", "Historique des echanges"],
  "intent": "get_contact_info",
  "confidence": 1,
  "engine": "local",
  "awaiting": null,
  "state": { "turns": 2, "lastIntent": "get_contact_info", "lastRecord": { "type": "clients", "id": "cli-001", "nom": "Marie Dupont" }, "pending": null },
  "latencyMs": 12,
  "sessionId": "s-abc12345"
}
```

| Champ | Description |
|---|---|
| `intent` | Intention retenue (`unknown` si non comprise, `affirm` / `deny` pour un oui / non sans question en attente) |
| `confidence` | 0 a 1 |
| `engine` | `local`, `openai` ou `anthropic` |
| `awaiting` | `null`, `slots`, `confirm`, `choose` ou `disambiguate` : le moteur attend une reponse |
| `actions[].type` | `navigate` (avec `auto: true` le widget navigue seul), `refresh` (recharger les donnees affichees) |
| `state` | A renvoyer tel quel dans la requete suivante |

Exemple de dialogue d'ecriture :

```
> ajoute un client                      awaiting: slots   "Quel est le nom du client ?"
> Aicha Konate                          awaiting: slots   "Quelle est son adresse email ?"
> aicha@konate.bj                       awaiting: confirm "Creer le client : ... Confirmez-vous ?"
> oui                                   awaiting: null    "Client Aicha Konate cree avec succes."
```

## Exemples curl

```bash
# Connexion
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@crm.com","password":"admin123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# Clients actifs
curl -s -H "Authorization: Bearer $TOKEN" "localhost:5000/api/clients?statut=actif&limit=5"

# Question au chatbot
curl -s -X POST localhost:5000/api/chatbot/message -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"message":"combien de prospects nouveaux ?"}'
```
