# Catalogue des intentions du chatbot

Fichier genere automatiquement par `node scripts/generate-intents-doc.js`. Ne pas modifier a la main.

Le moteur reconnait **30 intentions** a partir de **397 phrases d'entrainement**.

## Conversation

| Intention | Description | Exemples de phrases |
|---|---|---|
| `greeting` | Salutation d'ouverture | "bonjour", "salut", "bonsoir" |
| `goodbye` | Prise de conge | "au revoir", "a bientot", "a plus tard" |
| `thanks` | Remerciement ou compliment | "merci", "merci beaucoup", "super merci" |
| `how_are_you` | Question sur l'etat de l'assistant | "ca va", "comment vas tu", "comment allez vous" |
| `bot_identity` | Question sur l'identite de l'assistant | "qui es tu", "tu es qui", "comment tu t appelles" |
| `help` | Demande d'aide ou de liste des capacites | "aide", "aide moi", "que peux tu faire" |
| `off_topic` | Question sans rapport avec le CRM (culture generale, calcul, divertissement...) | "quelle est la capitale de la france", "raconte moi une blague", "quel temps fait il demain" |

## Consultation du CRM

| Intention | Description | Exemples de phrases |
|---|---|---|
| `stats_overview` | Resume global de l'activite (tableau de bord) | "donne moi un resume", "tableau de bord", "vue d ensemble" |
| `count_records` | Compter des clients, prospects, opportunites ou interactions | "combien de clients", "nombre de prospects", "combien d opportunites gagnees" |
| `list_records` | Lister des enregistrements (avec filtres de statut, montant, periode) | "liste les clients", "montre moi les prospects", "affiche les opportunites gagnees" |
| `find_record` | Rechercher une personne, une entreprise ou un email | "cherche Marie Dupont", "trouve le client Jean Martin", "recherche ACME" |
| `get_contact_info` | Obtenir un champ precis d'une fiche (email, telephone, entreprise, notes...) | "quel est l email de Marie Dupont", "donne moi le telephone de Jean Martin", "numero de Fatou Sow" |
| `record_details` | Afficher la fiche complete d'un client, prospect ou opportunite | "fiche de Marie Dupont", "details sur le client Jean Martin", "parle moi de TechFR" |
| `revenue_total` | Chiffre d'affaires (opportunites gagnees), eventuellement sur une periode | "quel est mon chiffre d affaires", "combien j ai gagne", "ca gagne" |
| `pipeline_overview` | Etat et valeur du pipeline commercial par etape | "etat du pipeline", "valeur du pipeline", "repartition des opportunites par statut" |
| `top_opportunities` | Classement des opportunites par montant | "plus grosses opportunites", "meilleure affaire", "top 3 des opportunites" |
| `closing_soon` | Opportunites dont la cloture approche ou est depassee | "quelles opportunites se terminent bientot", "affaires a cloturer ce mois", "deadline des opportunites" |
| `recent_activity` | Dernieres interactions et activite recente | "dernieres interactions", "derniere activite", "quoi de neuf" |
| `conversion_rate` | Taux de conversion prospects vers clients | "taux de conversion", "combien de prospects convertis en pourcentage", "quel pourcentage de prospects devient client" |
| `interaction_history` | Historique des echanges avec un client ou prospect precis | "historique des echanges avec Marie Dupont", "interactions de Jean Martin", "derniers appels avec Koffi" |
| `followup_suggestions` | Suggestions de relance et priorites commerciales | "qui dois je relancer", "quels prospects relancer", "clients a recontacter" |

## Systeme

| Intention | Description | Exemples de phrases |
|---|---|---|
| `storage_status` | Etat de la base de donnees (Neon PostgreSQL ou JSON) | "quel mode de stockage", "la base de donnees est connectee", "est ce que neon fonctionne" |

## Navigation

| Intention | Description | Exemples de phrases |
|---|---|---|
| `navigate` | Ouvrir une page de l'application | "va sur la page clients", "ouvre les prospects", "emmene moi aux opportunites" |

## Actions d'ecriture (avec confirmation)

| Intention | Description | Exemples de phrases |
|---|---|---|
| `create_client` | Creer un client | "ajoute un client", "cree un nouveau client Marie Dupont", "nouveau client Jean Martin chez ACME" |
| `create_prospect` | Creer un prospect | "ajoute un prospect", "nouveau prospect", "cree un lead" |
| `create_opportunity` | Creer une opportunite commerciale | "ajoute une opportunite", "cree une affaire de 15000 euros pour ACME", "nouvelle opportunite Refonte site web" |
| `log_interaction` | Enregistrer un appel, email, reunion ou note | "note un appel avec Marie Dupont", "enregistre une reunion avec Jean Martin", "ajoute une interaction pour Koffi" |
| `convert_prospect` | Convertir un prospect en client | "convertis Pierre Durand en client", "transforme le prospect Amina en client", "passe Camille Moreau en client" |
| `update_status` | Changer le statut d'un client, prospect ou opportunite | "passe l opportunite Migration cloud en gagnee", "marque le client Sophie comme actif", "change le statut de Marie en inactif" |
| `delete_record` | Supprimer un enregistrement | "supprime le client Lucas Bernard", "efface le prospect Camille", "retire l opportunite Audit" |

### Informations demandees pour `create_client`

| Information | Obligatoire | Question posee si elle manque |
|---|---|---|
| `nom` | oui | Quel est le nom du client ? |
| `email` | oui | Quelle est son adresse email ? |
| `telephone` | non | - |
| `entreprise` | non | - |

### Informations demandees pour `create_prospect`

| Information | Obligatoire | Question posee si elle manque |
|---|---|---|
| `nom` | oui | Quel est le nom du prospect ? |
| `email` | oui | Quelle est son adresse email ? |
| `telephone` | non | - |
| `entreprise` | non | - |
| `source` | non | - |

### Informations demandees pour `create_opportunity`

| Information | Obligatoire | Question posee si elle manque |
|---|---|---|
| `titre` | oui | Quel est l'intitule de l'opportunite ? |
| `montant` | oui | Quel est le montant (en euros) ? |
| `client` | non | - |
| `date_cloture` | non | - |

### Informations demandees pour `log_interaction`

| Information | Obligatoire | Question posee si elle manque |
|---|---|---|
| `cible` | oui | Avec quel client ou prospect ? (donnez son nom) |
| `type` | oui | De quel type d'interaction s'agit-il ? (appel, email, reunion ou note) |
| `sujet` | non | - |
| `contenu` | non | - |
| `date` | non | - |

### Informations demandees pour `convert_prospect`

| Information | Obligatoire | Question posee si elle manque |
|---|---|---|
| `cible` | oui | Quel prospect voulez-vous convertir en client ? |

### Informations demandees pour `update_status`

| Information | Obligatoire | Question posee si elle manque |
|---|---|---|
| `cible` | oui | Quel enregistrement voulez-vous modifier ? (donnez son nom ou son intitule) |
| `statut` | oui | Quel est le nouveau statut ? |

### Informations demandees pour `delete_record`

| Information | Obligatoire | Question posee si elle manque |
|---|---|---|
| `cible` | oui | Quel enregistrement voulez-vous supprimer ? (donnez son nom ou son intitule) |

