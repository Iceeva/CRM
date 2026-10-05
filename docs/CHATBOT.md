# Chatbot assistant : moteur de reconnaissance d'intentions

Ce document decrit en detail le fonctionnement du chatbot : pipeline de traitement, couches NLP, classifieur, extraction d'entites, dialogue multi-tours, securite et extension. Le catalogue complet des intentions est dans [INTENTS.md](INTENTS.md), l'integration OpenAI et Anthropic dans [AI_PROVIDERS.md](AI_PROVIDERS.md).

## 1. Principes de conception

1. **Local d'abord.** Le moteur fonctionne entierement sans service externe, sans cle d'API et sans cout. OpenAI et Anthropic sont des **options** qui s'ajoutent, jamais des dependances.
2. **Deterministe et explicable.** Chaque decision se decompose en scores lisibles (`/api/chatbot/analyze`). Pas de boite noire pour les actions sur les donnees.
3. **Aucune ecriture sans confirmation.** Creer, modifier, convertir ou supprimer demande toujours un "oui" explicite apres un resume.
4. **Sans memoire serveur.** L'etat du dialogue voyage dans chaque requete : le moteur fonctionne sur Vercel, ou chaque appel peut tomber sur une instance differente.
5. **Prefere demander que deviner.** Confiance faible, ambiguite ou reference introuvable : le moteur pose une question plutot que d'agir.
6. **Zero dependance NLP.** Tout est ecrit en JavaScript pur dans `backend/src/chatbot/` (aucun modele a telecharger, demarrage instantane).

## 2. Vue d'ensemble du pipeline

```
Message utilisateur
      |
      v
[1] Normalisation ---------> minuscules, sans accents, apostrophes, argot SMS (bjr, mdp, opps...)
      |
      v
[2] Tokenisation ----------> mots, racines (stems), mots vides retires, bigrammes/trigrammes
      |
      v
[3] Extraction d'entites --> type de ressource, statut, champ, noms, entreprise, email, telephone,
      |                      montant, contrainte de montant, date, periode, nombre, tri, pronom, oui/non
      v
[4] Masquage --------------> noms propres, entreprises et textes entre guillemets remplaces par un marqueur
      |                      (une entreprise "Nouveau Monde" ne declenche pas "creer un nouveau ...")
      v
[5] Classification --------> 4 signaux : lexical (IDF), mots-cles, patrons, coherence des entites
      |                      -> scores, probabilites (softmax), confiance, ambiguite
      v
[6] Dialogue --------------> reponse a un slot / confirmation / choix ? sinon relance contextuelle ?
      |
      v
[7] Decision --------------> ambigu : question de precision | confiance faible : IA optionnelle ou aide
      |                      | sinon : execution du handler
      v
[8] Handler ---------------> lecture (stockage Neon/JSON) ou action d'ecriture (confirmation obligatoire)
      |
      v
[9] Reponse ---------------> texte, cartes cliquables, actions (navigation, rafraichissement),
                             reponses rapides, nouvel etat de dialogue, intention, confiance, moteur
```

Code : `backend/src/chatbot/engine/index.js` (orchestrateur), `classifier.js`, `dialog.js`, `resolver.js`, `state.js`, `format.js`.

## 3. Couche NLP (`backend/src/chatbot/nlp/`)

### 3.1 Normalisation (`normalize.js`)

| Etape | Exemple |
|---|---|
| Typographie : apostrophes et guillemets unifies | `l’email` -> `l'email` |
| Minuscules et suppression des accents (NFD) | `Réunion` -> `reunion` |
| Apostrophes remplacees par une espace | `d'opportunites` -> `d opportunites` |
| Ponctuation retiree (on garde `@ . + : / % -` pour emails, dates, montants) | `rendez-vous` -> `rendez vous` |
| Argot et abreviations developpes (environ 90 entrees) | `bjr stp` -> `bonjour s il te plait`, `mdp` -> `mot de passe`, `opps` -> `opportunites`, `rdv` -> `rendez vous` |

### 3.2 Mots vides (`stopwords.js`)

Les mots vides (le, de, pour...) n'apportent pas d'intention et sont ignores par le signal lexical. Sont **volontairement conserves** : les negations, les mots interrogatifs (combien, quand...), les marqueurs de quantite (tous, derniers).

### 3.3 Racinisation (`stemmer.js`)

Reduit les mots a une racine approximative pour que `client`, `clients`, `cliente` ou `ajouter`, `ajoute`, `ajoutez` soient equivalents. Pluriel, suffixes derivationnels et verbaux, e muet, consonnes doublees, quelques irreguliers. Ce n'est pas un stemmer Snowball complet : l'important est la **coherence** (le meme stemmer sert au catalogue et aux phrases).

### 3.4 Similarite et fautes de frappe (`similarity.js`)

| Mesure | Role |
|---|---|
| Damerau-Levenshtein | Distance d'edition avec transposition (`cleint` -> `client` = 1) |
| Tolerance adaptee a la longueur | 0 erreur jusqu'a 3 lettres, 1 jusqu'a 5, 2 jusqu'a 9, 3 au-dela. **Calculee sur le mot le plus court** : `prospect` ne vaut pas `prospection` |
| Jaro-Winkler | Noms propres : `Dupond` ~ `Dupont` (0.93) |
| Regle de prefixe | `prospec` ~ `prospect` (0.92), desactivable (`{ prefix: false }`) |

### 3.5 Dates et periodes (`dates.js`)

| Famille | Exemples compris |
|---|---|
| Relatives | aujourd'hui, hier, avant-hier, demain, apres-demain |
| Semaine | cette semaine, la semaine derniere, la semaine prochaine (lundi a dimanche) |
| Mois | ce mois-ci, le mois dernier, le mois prochain, en octobre, en septembre 2026 |
| Trimestre et annee | ce trimestre, le trimestre dernier, cette annee, l'annee derniere |
| Glissantes | les 7 derniers jours, depuis 2 semaines, sur 3 mois |
| Absolues | 12/10/2026, 12-10-2026, 12.10.26, 2026-10-12, 12 octobre, 1er novembre 2026 |
| Jours de semaine | lundi, vendredi prochain, mardi dernier |

Les dates impossibles (31/02/2026) sont rejetees. Toutes les fonctions acceptent un `now` injectable, ce qui rend les tests deterministes.

### 3.6 Montants et nombres (`numbers.js`)

Formats francais : `15000`, `15 000`, `15.000`, `15 000,50`, `12k`, `2,5 M`, `2 millions`, `15000 euros`, `15 k€`. Les dates et numeros de telephone ne sont pas pris pour des montants. Contraintes : `plus de 10k`, `moins de 500`, `entre 1000 et 5000`, `au moins`, `au plus`. Nombres d'elements : `top 3`, `les 5 derniers`.

### 3.7 Entites (`entities.js`)

| Entite | Valeurs | Detecte via |
|---|---|---|
| `entityType` | clients, prospects, opportunities, interactions | Synonymes : lead, piste, affaire, deal, devis, echange... (tolerant aux fautes) |
| `statut` | actif, inactif, nouveau, contacte, converti, prospection, qualification, proposition, negociation, gagnee, perdue, ouvertes | Synonymes et accords : gagne, signe, remporte, perdu, echoue, "en cours"... |
| `interactionType` | appel, email, reunion, note | Synonymes : coup de fil, mail, rdv, visio, demo... |
| `field` | email, telephone, entreprise, notes, statut, montant, source, date_cloture | "joindre", "coordonnees", "numero", "societe"... |
| `names` | Noms propres | Majuscules, particules (de, van, ben...), hors vocabulaire connu |
| `company` | Entreprise | "chez X", "societe X", "entreprise X" |
| `title` | Intitule | Guillemets, "intitule", "nomme", "sujet" |
| `emails`, `phones` | Coordonnees | Expressions regulieres |
| `amount`, `amountConstraint`, `count`, `date`, `period` | Voir 3.5 et 3.6 | |
| `sort` | desc, asc | "plus gros", "meilleur", "plus ancien"... (une periode comme "le mois dernier" n'est pas un tri) |
| `pronoun` | vrai/faux | "lui", "son email", "ce client", "cette affaire" |
| `yes` / `no` | Reponses courtes | "oui", "ok", "vas-y" / "non", "annule", "laisse tomber" |
| `residual` | Mots inconnus du vocabulaire | Candidats pour une recherche floue (nom saisi en minuscules) |

Cas traites explicitement : "chiffre d'affaires" ne contient pas une opportunite ("affaires"), "telephone" n'est pas un appel, "nouveau client" est une creation et non un statut de prospect.

## 4. Classifieur (`engine/classifier.js`)

### 4.1 Quatre signaux independants

Pour chaque intention (30), un score total est calcule :

```
total = 0.42 * lexical + 0.22 * mots_cles + 0.46 * patrons + ajustement_entites
```

| Signal | Calcul |
|---|---|
| **Lexical** | Similarite de Dice ponderee par l'**IDF** entre la phrase et chaque exemple d'entrainement, avec correspondance floue (fautes) et par racine. Les mots rares (pipeline, relancer) pesent plus que les mots frequents (client, liste). Score = 75 % du meilleur exemple + 25 % de la moyenne des 3 meilleurs. |
| **Mots-cles** | Mots forts (+0.30 chacun) et faibles (+0.10), plafonnes a 1. |
| **Patrons** | Expressions regulieres precises. Combinaison "OU bruite" : `1 - produit(1 - w)`. Deux patrons se renforcent sans depasser 1. |
| **Entites** | Coherence avec ce qui a ete extrait : bonus si le type de ressource est celui attendu (+0.18), malus si rejete (-0.35), entite obligatoire manquante (-0.18), bonus plafonne (+0.20), malus (-0.10 par entite incoherente), phrases sociales trop longues (-0.35), interdictions par motif (-1.0). |

### 4.2 Confiance

```
confiance = 0.55 * min(1, meilleur_score / 0.6) + 0.45 * min(1, ecart_avec_le_second / 0.2)
```

La confiance combine le **niveau absolu** du meilleur score et son **avance** sur la deuxieme intention. Seuil de comprehension : `CHATBOT_MIN_CONFIDENCE` (0.55 par defaut).

### 4.3 Ambiguite et desambiguisation

Si les deux meilleures intentions appartiennent au meme **groupe confondable** (`intents/index.js`), que leur ecart est inferieur a 0.10 et que la confiance reste sous 0.90, le moteur pose une question avec reponses rapides au lieu de deviner :

| Groupe | Question posee |
|---|---|
| creer client / prospect / opportunite | "Que souhaitez-vous creer exactement ?" |
| fiche / coordonnees / recherche / historique | "Que voulez-vous savoir exactement ?" |
| CA / pipeline / plus grosses opportunites | "Quelle information financiere souhaitez-vous ?" |
| comptage / liste | "Voulez-vous le nombre ou la liste ?" |

### 4.4 Masquage des noms propres

Avant la classification, noms, entreprises, emails et textes entre guillemets sont remplaces par un marqueur neutre. Ainsi "ajoute le client **Nouveau Monde**" ne declenche pas une intention a cause du mot "nouveau", et un client qui s'appelle "Pipeline SA" ne declenche pas l'analyse du pipeline.

### 4.5 Qualite mesuree

Le jeu de test `backend/test/chatbot.intents.test.js` contient **113 phrases inedites** (absentes des exemples d'entrainement) couvrant les 30 intentions, avec fautes de frappe, abreviations et formulations variees. Il exige une precision d'au moins 95 % (100 % a la livraison) et verifie que 8 phrases hors sujet ne sont jamais prises pour une action du CRM. Ces chiffres sont mesures sur un jeu ecrit par l'equipe du projet : sur du langage reel d'utilisateurs, attendez-vous a un peu moins. Ajoutez vos phrases en echec dans les tests (section 9).

## 5. Dialogue multi-tours (`engine/dialog.js`)

### 5.1 Etat du dialogue

```json
{
  "turns": 3,
  "lastIntent": "get_contact_info",
  "lastResource": "clients",
  "lastRecord": { "type": "clients", "id": "cli-001", "nom": "Marie Dupont" },
  "lastEntities": { "entityType": "clients", "field": "email" },
  "pending": { "kind": "slots", "intent": "create_client", "slots": { "nom": "Aicha" }, "awaiting": "email", "ttl": 6 }
}
```

### 5.2 Types de dialogue en attente (`pending.kind`)

| Type | Declencheur | Comportement |
|---|---|---|
| `slots` | Information obligatoire manquante | Pose la question du slot suivant. La reponse est interpretee selon le slot (email valide, montant, type, date, nom...). Une reponse peut aussi fournir d'autres informations. |
| `confirm` | Action prete | Affiche un resume et attend oui / non. Avant execution, les references sont **re-verifiees** (la donnee a pu changer). |
| `choose` | Reference ambigue ("ACME" correspond a 4 enregistrements) | Liste numerotee ; reponse par numero ("2"), par nom ou par mot distinctif. |
| `disambiguate` | Deux intentions proches | Voir 4.3. |

Un dialogue expire apres **6 tours** sans reponse. A tout moment :
- "annule", "laisse tomber", "stop", "non" abandonnent l'action ;
- une phrase tres claire sur un autre sujet (confiance >= 0.85 et patron reconnu) **change de sujet** : "ajoute un client" puis "combien de prospects nouveaux ?" repond a la question.

### 5.3 Relances contextuelles

"Combien de clients actifs ?" puis "et les prospects ?" reprend l'intention precedente avec le nouveau type de ressource. "Quel est l'email de Marie Dupont ?" puis "et son telephone ?" reprend la meme personne. Le statut precedent n'est conserve que pour la meme ressource.

### 5.4 Resolution des references (`engine/resolver.js`)

"marie dupond" (faute), "chez ACME", "marie@acme.com", "l'opportunite fintech" ou "lui" deviennent un enregistrement :

1. Termes candidats : email, noms propres, entreprise, intitule, mots residuels.
2. Recherche "contient" via le stockage (index SQL en mode Neon).
3. Sinon recherche floue (Jaro-Winkler et distance d'edition) sur nom, entreprise, titre, email.
4. Resultat : **resolu** (candidat net : score >= 0.97 ou ecart >= 0.07), **ambigu** (plusieurs candidats proches, le moteur demande) ou **introuvable**.
5. Pronoms : dernier enregistrement evoque dans la conversation.

## 6. Actions d'ecriture (`handlers/write.js`)

| Action | Informations obligatoires | Particularites |
|---|---|---|
| Creer un client / prospect | nom, email | Doublon d'email detecte, email valide exige |
| Creer une opportunite | intitule, montant | Client optionnel (resolu en base, ignore s'il est introuvable), statut initial "prospection" |
| Enregistrer une interaction | cible, type | Sujet genere si absent ("Appel avec ..."), date relative ("hier") comprise |
| Convertir un prospect | prospect | Cree le client, passe le prospect en "converti", journalise une note |
| Changer un statut | enregistrement, statut | Verifie que le statut existe pour ce type (un client ne peut pas etre "gagne") |
| Supprimer | enregistrement | Avertissement sur les suppressions en cascade, mention "irreversible" |

## 7. Securite

| Risque | Parade |
|---|---|
| Etat de dialogue falsifie par le client | `state.js` : liste blanche de cles, types verifies, tailles limitees, intentions et types valides uniquement |
| Action destructrice involontaire | Confirmation obligatoire, resume explicite, re-verification avant execution |
| Injection de HTML dans les reponses | Le widget rend le texte sans `dangerouslySetInnerHTML` (gras uniquement, via React) |
| Abus / cout IA | Limiteur de debit : 40 messages par minute et par utilisateur |
| Fuite de donnees vers l'IA | Emails et telephones masques, donnees CRM envoyees uniquement agregees (voir AI_PROVIDERS.md) |
| Fuite de details techniques | `_debug` et `/api/chatbot/analyze` desactives hors `CHATBOT_DEBUG=true` |
| Droits d'acces | Toutes les routes exigent un JWT ; le chatbot ne depasse jamais les droits de l'API |

## 8. Deboguer le moteur

Avec `CHATBOT_DEBUG=true` (par defaut hors production) :

```bash
curl -X POST http://localhost:5000/api/chatbot/analyze \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"montre les opps gagnées de plus de 10k"}'
```

La reponse detaille l'intention, la confiance, l'ecart, les entites et leur source, le texte normalise et masque, et pour les 5 meilleures intentions : score, part lexicale, mots-cles, patrons reconnus, ajustement et notes (`-manque:field`, `-bloque`...). Ajoutez `?debug=1` a `/api/chatbot/message` pour obtenir la meme analyse avec la reponse.

## 9. Etendre le moteur

### Ajouter une intention

1. **Declarer** l'intention dans `intents/read.js`, `write.js` ou `social.js` : `id`, `description`, `handler`, 8 a 15 `examples`, `keywords`, `patterns`, `rules`.
2. **Coder** le handler dans `handlers/read.js` (fonction `async (ctx) => ({ reply, items?, actions?, quickReplies?, record? })`) ou une action dans `handlers/write.js` (`fill`, `resolve`, `summary`, `execute`).
3. **Tester** : ajouter des phrases inedites dans `test/chatbot.intents.test.js` et un scenario dans `test/chatbot.dialog.test.js`.
4. **Regenerer** la doc : `node scripts/generate-intents-doc.js`.

Il n'y a **aucun entrainement** : le modele (IDF, racines, mots-cles) est reconstruit au chargement du module.

### Corriger une mauvaise reconnaissance

1. Reproduisez avec `/api/chatbot/analyze` et regardez quel signal domine.
2. Phrase non reconnue : ajoutez-la (ou une variante) aux `examples` ; si un mot cle manque, ajoutez-le aux `keywords`.
3. Mauvaise intention toujours choisie : ajoutez un `blockIfPattern` a l'intention fautive, ou un patron plus precis a la bonne.
4. Argot manquant : completez `SLANG` dans `nlp/normalize.js`.
5. Relancez `npm test` : la precision ne doit pas baisser.

### Limites connues

- Langue : francais uniquement.
- Les questions analytiques complexes (comparaisons, jointures libres) ne sont pas comprises par le moteur local ; avec une IA configuree elles recoivent une reponse generale fondee sur des statistiques agregees.
- Les noms propres tres inhabituels peuvent exiger une majuscule pour etre reconnus (sinon la recherche floue en base prend le relais).
- Maximum 500 enregistrements par type charges pour les calculs de listes et de periodes.
