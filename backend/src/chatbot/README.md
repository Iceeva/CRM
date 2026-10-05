# Chatbot : moteur d'intentions

Code du moteur de reconnaissance d'intentions. Documentation complete : [docs/CHATBOT.md](../../../docs/CHATBOT.md).

## Carte du dossier

```
chatbot/
|-- nlp/                    Traitement du langage (JavaScript pur, aucune dependance)
|   |-- normalize.js        Minuscules, accents, apostrophes, argot SMS (environ 90 abreviations)
|   |-- stopwords.js        Mots vides, negations, mots interrogatifs
|   |-- stemmer.js          Racinisation legere du francais
|   |-- tokenizer.js        Mots, racines, n-grammes
|   |-- similarity.js       Damerau-Levenshtein, Jaro-Winkler, tolerance aux fautes
|   |-- dates.js            Dates et periodes relatives, absolues, glissantes
|   |-- numbers.js          Montants (12k, 2,5 M, 15 000 euros), contraintes, nombres
|   '-- entities.js         Type, statut, champ, noms, entreprise, email, telephone, tri, pronom, oui/non
|-- intents/                Catalogue des 30 intentions
|   |-- social.js           Salutation, au revoir, merci, identite, aide, hors sujet
|   |-- read.js             Consultation (stats, comptage, listes, recherche, CA, pipeline, relances...)
|   |-- write.js            Ecriture avec slots et confirmation (creer, convertir, statut, supprimer...)
|   '-- index.js            Assemblage et groupes d'intentions confondables
|-- engine/
|   |-- classifier.js       Classifieur hybride : lexical (IDF), mots-cles, patrons, entites
|   |-- dialog.js           Slots, confirmation, choix, annulation, changement de sujet
|   |-- resolver.js         Reference floue -> enregistrement (nom, entreprise, email, pronom)
|   |-- state.js            Etat de conversation cote client, assaini cote serveur
|   |-- format.js           Montants, dates, accords, listes
|   '-- index.js            Orchestrateur : respond()
|-- handlers/
|   |-- social.js           Reponses conversationnelles
|   |-- read.js             Consultation
|   |-- write.js            Actions : fill, resolve, summary, execute
|   |-- helpers.js          Filtres, periodes, montants, references
|   '-- index.js            Registre handler -> fonction
|-- llm/                    IA optionnelle
|   |-- openai.js           Chat Completions (base URL configurable)
|   |-- anthropic.js        API Messages
|   |-- http.js             fetch avec delai maximal et erreurs typees
|   '-- index.js            Chaine de fournisseurs, bascule, masquage des donnees
'-- service.js              Historique des conversations et appel du moteur
```

## Utiliser le moteur sans serveur

```js
const { respond } = require("./engine");

let state = null;
const r1 = await respond({ text: "ajoute un client", state, user: { nom: "Claude" } });
state = r1.state;                         // a conserver et rappeler au message suivant
const r2 = await respond({ text: "Aicha Konate", state, user: { nom: "Claude" } });
```

`respond()` renvoie `{ reply, items, actions, quickReplies, intent, confidence, engine, awaiting, state, latencyMs }`.

## Analyser une phrase

```js
const { classify } = require("./engine/classifier");
const r = classify("montre les opps gagnees de plus de 10k");
// r.intent, r.confidence, r.margin, r.entities, r.analysis, r.candidates (scores detailles)
```

## Ajouter une intention en 4 etapes

1. Declarez-la dans `intents/*.js` (`id`, `description`, `handler`, 8 a 15 `examples`, `keywords`, `patterns`, `rules`).
2. Ecrivez son handler dans `handlers/read.js` (ou une action dans `handlers/write.js`).
3. Ajoutez des phrases **inedites** dans `backend/test/chatbot.intents.test.js`.
4. `npm test`, puis `node scripts/generate-intents-doc.js`.

Aucun entrainement n'est necessaire : le modele est reconstruit au chargement du module.

## Regles a respecter

- Une intention d'ecriture porte `confirm: true` : aucune ecriture sans "oui".
- Un patron de `blockIfPattern` evite les faux positifs ; preferez-le a un seuil trop haut.
- Le texte sans accents : les patrons s'ecrivent sur le texte **normalise** (`l email`, `d affaires`).
- L'etat renvoye au client ne doit contenir que des valeurs simples (voir `engine/state.js`) : toute nouvelle cle doit etre ajoutee a la liste blanche.
