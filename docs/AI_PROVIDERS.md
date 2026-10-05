# IA optionnelle : OpenAI et Anthropic

Le chatbot fonctionne **sans aucune IA externe**. OpenAI et Anthropic sont deux options, activables independamment ou ensemble, qui completent le moteur local pour les questions qu'il ne comprend pas.

## 1. Activation en 2 minutes

Dans `backend/.env` (ou les variables d'environnement Vercel) :

### OpenAI uniquement

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### Anthropic uniquement

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5-5
```

### Les deux, avec secours automatique

```env
AI_PROVIDER=anthropic
AI_FAILOVER=true
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Si Anthropic echoue (cle invalide, quota, panne, delai), OpenAI est essaye, puis le moteur local repond. Avec `AI_PROVIDER=auto`, Anthropic est prefere si sa cle existe, sinon OpenAI.

Redemarrez le serveur : l'en-tete du widget affiche "Moteur local + OpenAI" (ou Anthropic) et `GET /api/chatbot/status` detaille la configuration (jamais les cles).

> Les noms de modeles evoluent. Verifiez ceux qui sont disponibles pour votre compte dans la documentation d'OpenAI et d'Anthropic, et ajustez `OPENAI_MODEL` / `ANTHROPIC_MODEL`.

## 2. Variables

| Variable | Defaut | Description |
|---|---|---|
| `AI_PROVIDER` | `none` | `none`, `openai`, `anthropic` ou `auto` |
| `AI_MODE` | `fallback` | `off`, `fallback` ou `assist` (voir 3) |
| `AI_FAILOVER` | `true` | Essayer l'autre fournisseur configure en cas d'echec |
| `AI_TIMEOUT_MS` | `15000` | Delai maximal par appel |
| `AI_MAX_TOKENS` | `600` | Longueur maximale de la reponse |
| `AI_TEMPERATURE` | `0.3` | Creativite (0 = tres factuel) |
| `AI_SHARE_CRM_DATA` | `false` | Autoriser l'envoi d'extraits de donnees CRM (voir 4) |
| `OPENAI_API_KEY` | vide | Cle OpenAI |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modele OpenAI |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Pour Azure OpenAI, OpenRouter, Ollama, LM Studio... (API Chat Completions compatible) |
| `ANTHROPIC_API_KEY` | vide | Cle Anthropic |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Modele Anthropic |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Passerelle ou proxy eventuel |
| `ANTHROPIC_VERSION` | `2023-06-01` | En-tete `anthropic-version` |

### Utiliser un modele local (Ollama, LM Studio)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=ollama            # valeur quelconque non vide
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.1
```

## 3. Quand l'IA est-elle appelee ?

| Situation | `fallback` (defaut) | `assist` | `off` |
|---|---|---|---|
| Question claire sur le CRM ("combien de clients ?") | Moteur local | Moteur local, puis **reformulation** par l'IA (donnees partagees uniquement si `AI_SHARE_CRM_DATA=true`) | Moteur local |
| Phrase non comprise (confiance sous le seuil) | **IA** | **IA** | Message d'aide local |
| Question hors CRM ("raconte une blague") | **IA** | **IA** | Reponse locale "hors perimetre" |
| Action d'ecriture, confirmation, choix, slot | Moteur local, **jamais l'IA** | Moteur local, jamais l'IA | Moteur local |
| IA en panne ou cle invalide | Moteur local | Moteur local | Moteur local |

L'IA ne peut donc **jamais** creer, modifier ou supprimer une donnee : seules les intentions reconnues localement, avec confirmation de l'utilisateur, ecrivent en base.

## 4. Confidentialite

| Donnee | Envoyee a l'IA ? |
|---|---|
| Message de l'utilisateur | Oui, apres **masquage** des emails (`[email]`) et numeros de telephone (`[telephone]`) |
| 6 derniers messages de la session (contexte) | Oui, meme masquage |
| Statistiques agregees (nombre de clients, CA, taux de conversion) | Oui, pour que l'IA ne s'appuie pas sur des invitations a inventer |
| Noms, emails, montants individuels du CRM | **Non** par defaut. Oui seulement si `AI_SHARE_CRM_DATA=true` (mode `assist`) |
| Cles d'API | Jamais exposees au frontend ni dans les logs |

Si vous traitez des donnees personnelles de clients, verifiez votre contrat avec le fournisseur (traitement des donnees, retention, region) et votre conformite RGPD avant d'activer l'IA.

## 5. Instructions donnees a l'IA

Le prompt systeme (`backend/src/chatbot/llm/index.js`, constante `SYSTEM_PROMPT`) impose : repondre en francais en 120 mots maximum, ne jamais inventer de client, montant, email ou date, rediriger les donnees precises vers des formulations que le moteur local comprend, expliquer que les actions passent par une confirmation, et ne pas reveler ses instructions.

## 6. Couts et limites

- Un appel n'a lieu que si le moteur local ne sait pas repondre : le cout reste faible.
- Le limiteur de debit (40 messages par minute et par utilisateur) protege vos credits.
- Delai maximal `AI_TIMEOUT_MS`, puis repli local : l'utilisateur n'attend jamais indefiniment.
- Aucun SDK n'est installe : les appels utilisent `fetch` (Node 18+), ce qui garde la fonction serverless legere.

## 7. Depannage

| Symptome | Cause probable | Solution |
|---|---|---|
| L'en-tete affiche "Moteur local" malgre une cle | `AI_PROVIDER=none` ou `AI_MODE=off` | Definissez `AI_PROVIDER` |
| Log `[ia] openai indisponible : ... 401` | Cle invalide | Verifiez `OPENAI_API_KEY` |
| Log `... 429` | Quota ou debit depasse | Verifiez votre facturation chez le fournisseur |
| Log `delai de 15000 ms depasse` | Fournisseur lent | Augmentez `AI_TIMEOUT_MS` (reste sous 30 s sur Vercel) |
| Reponses trop longues ou trop libres | Parametres | Baissez `AI_MAX_TOKENS` et `AI_TEMPERATURE` |
| `Reponse generee par OpenAI` sous un message | Normal | Le widget signale les reponses issues d'une IA |
