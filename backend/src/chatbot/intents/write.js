/**
 * chatbot/intents/write.js - Intentions d'ecriture (creation, modification, suppression)
 * ----------------------------------------------------------------------------
 * Ces intentions modifient les donnees : le moteur exige toujours une
 * confirmation explicite (oui / non) avant d'executer l'action, et les
 * informations manquantes sont demandees une par une (remplissage de slots).
 *
 * `slots` decrit les informations necessaires :
 *   name      : cle dans l'etat du dialogue
 *   required  : true => le moteur pose la question tant que la valeur manque
 *   prompt    : question posee a l'utilisateur
 *   from      : entite(s) du texte qui remplissent le slot automatiquement
 */
module.exports = [
  {
    id: "create_client",
    category: "ecriture",
    description: "Creer un client",
    handler: "createClient",
    confirm: true,
    examples: [
      "ajoute un client", "cree un nouveau client Marie Dupont", "nouveau client Jean Martin chez ACME",
      "enregistre un client", "ajouter le client Fatou Sow email fatou@x.com", "creer une fiche client",
      "ajoute cliente Nadia", "inscris un nouveau client", "je veux ajouter un client", "creer un client",
      "nouveau client", "ajouter un nouveau client dans le crm",
    ],
    keywords: {
      strong: ["ajoute", "ajouter", "cree", "creer", "enregistre", "enregistrer", "inscris", "nouveau"],
      weak: ["fiche", "saisir", "rajoute"],
    },
    patterns: [
      { re: /\b(ajoute|ajouter|ajoutez|cree|creer|creez|enregistre|enregistrer|enregistrez|inscris|inscrire|saisir|rajoute|rajouter)\b/, w: 0.55 },
      { re: /\bnouveau (client|cliente)\b/, w: 0.8 },
      { re: /\b(je veux|je voudrais|j aimerais|il faut) (ajouter|creer|enregistrer)\b/, w: 0.55 },
    ],
    rules: { prefer: ["clients"], reject: ["prospects", "opportunities", "interactions"], boost: ["names", "emails", "company"], needsVerb: "create" },
    slots: [
      { name: "nom", required: true, prompt: "Quel est le nom du client ?", from: ["names"] },
      { name: "email", required: true, prompt: "Quelle est son adresse email ?", from: ["emails"] },
      { name: "telephone", required: false, from: ["phones"] },
      { name: "entreprise", required: false, from: ["company"] },
    ],
  },
  {
    id: "create_prospect",
    category: "ecriture",
    description: "Creer un prospect",
    handler: "createProspect",
    confirm: true,
    examples: [
      "ajoute un prospect", "nouveau prospect", "cree un lead", "enregistre un nouveau prospect Pierre",
      "ajouter un prospect rencontre au salon", "note un nouveau lead Camille Moreau", "nouvelle piste commerciale",
      "creer un prospect", "ajoute le prospect Ibrahim Traore chez Abidjan Pay", "je veux ajouter un lead",
      "enregistrer un prospect", "ajoute un nouveau prospect dans le crm",
    ],
    keywords: {
      strong: ["ajoute", "ajouter", "cree", "creer", "enregistre", "enregistrer", "nouveau", "nouvelle"],
      weak: ["piste", "lead", "saisir", "rajoute"],
    },
    patterns: [
      { re: /\b(ajoute|ajouter|ajoutez|cree|creer|creez|enregistre|enregistrer|enregistrez|saisir|rajoute|rajouter|note|noter)\b/, w: 0.55 },
      { re: /\bnouveau (prospect|lead)\b|\bnouvelle (piste|prospecte)\b/, w: 0.8 },
      { re: /\b(je veux|je voudrais|j aimerais|il faut) (ajouter|creer|enregistrer)\b/, w: 0.55 },
    ],
    rules: { prefer: ["prospects"], reject: ["clients", "opportunities", "interactions"], boost: ["names", "emails", "company"], needsVerb: "create" },
    slots: [
      { name: "nom", required: true, prompt: "Quel est le nom du prospect ?", from: ["names"] },
      { name: "email", required: true, prompt: "Quelle est son adresse email ?", from: ["emails"] },
      { name: "telephone", required: false, from: ["phones"] },
      { name: "entreprise", required: false, from: ["company"] },
      { name: "source", required: false, from: [] },
    ],
  },
  {
    id: "create_opportunity",
    category: "ecriture",
    description: "Creer une opportunite commerciale",
    handler: "createOpportunity",
    confirm: true,
    examples: [
      "ajoute une opportunite", "cree une affaire de 15000 euros pour ACME", "nouvelle opportunite Refonte site web",
      "nouveau deal", "enregistre une opportunite", "ajouter un devis de 8000 euros", "creer une vente",
      "cree une opportunite de 20000 euros", "nouvelle affaire pour Marie Dupont", "ajoute un deal de 5000 euros",
      "creer une opportunite commerciale", "je veux ajouter une opportunite",
    ],
    keywords: {
      strong: ["ajoute", "ajouter", "cree", "creer", "enregistre", "enregistrer", "nouveau", "nouvelle"],
      weak: ["deal", "affaire", "devis", "vente", "opportunite"],
    },
    patterns: [
      { re: /\b(ajoute|ajouter|ajoutez|cree|creer|creez|enregistre|enregistrer|enregistrez|rajoute|rajouter|saisir)\b/, w: 0.55 },
      { re: /\bnouvelle? (opportunite|affaire|deal|vente|devis)\b/, w: 0.85 },
      { re: /\b(je veux|je voudrais|j aimerais|il faut) (ajouter|creer|enregistrer)\b/, w: 0.55 },
    ],
    rules: { prefer: ["opportunities"], reject: ["clients", "prospects", "interactions"], boost: ["title", "amount", "names"], needsVerb: "create" },
    slots: [
      { name: "titre", required: true, prompt: "Quel est l'intitule de l'opportunite ?", from: ["title"] },
      { name: "montant", required: true, prompt: "Quel est le montant (en euros) ?", from: ["amount"] },
      { name: "client", required: false, from: ["names"] },
      { name: "date_cloture", required: false, from: ["date"] },
    ],
  },
  {
    id: "log_interaction",
    category: "ecriture",
    description: "Enregistrer un appel, email, reunion ou note",
    handler: "logInteraction",
    confirm: true,
    examples: [
      "note un appel avec Marie Dupont", "enregistre une reunion avec Jean Martin", "ajoute une interaction pour Koffi",
      "j ai appele Fatou aujourd hui", "j ai envoye un email a Nadia", "j ai eu un rendez vous avec ACME hier",
      "log un appel", "consigne un echange avec Pierre", "ajoute une note pour Sophie Laurent",
      "j ai discute avec Camille", "j ai eu Amina au telephone", "enregistre un appel pour Ibrahim",
      "journalise une reunion avec Lucas Bernard",
    ],
    keywords: {
      strong: ["note", "noter", "enregistre", "consigne", "journalise", "log", "interaction", "appele", "discute"],
      weak: ["envoye", "eu", "echange"],
    },
    patterns: [
      { re: /\bj ai (appele|telephone|contacte|ecrit|envoye|discute|rencontre|vu|eu|relance|rappele|joint)\b/, w: 0.85 },
      { re: /\b(note|noter|enregistre|enregistrer|consigne|consigner|journalise|log|ajoute|ajouter|cree|creer) (un |une |l |cet |cette )?(appel|email|mail|reunion|rendez vous|rdv|note|echange|interaction|meeting|visio|demo|entretien)/, w: 0.9 },
      { re: /\b(appel|email|mail|reunion|rendez vous|rdv|note|echange|interaction) (avec|pour|aupres de|chez)\b/, w: 0.5 },
      { re: /\bj ai eu (un |une )?(appel|email|mail|reunion|rendez vous|rdv|echange|entretien|meeting)\b/, w: 0.9 },
    ],
    rules: { boost: ["names", "interactionType", "date", "residual"], needsVerb: "log", penalize: ["amountConstraint"] },
    slots: [
      { name: "cible", required: true, prompt: "Avec quel client ou prospect ? (donnez son nom)", from: ["names"] },
      { name: "type", required: true, prompt: "De quel type d'interaction s'agit-il ? (appel, email, reunion ou note)", from: ["interactionType"] },
      { name: "sujet", required: false, from: ["title"] },
      { name: "contenu", required: false, from: [] },
      { name: "date", required: false, from: ["date"] },
    ],
  },
  {
    id: "convert_prospect",
    category: "ecriture",
    description: "Convertir un prospect en client",
    handler: "convertProspect",
    confirm: true,
    examples: [
      "convertis Pierre Durand en client", "transforme le prospect Amina en client", "passe Camille Moreau en client",
      "Yves est devenu client", "conversion du prospect Ibrahim", "il a signe", "faire de Pierre un client",
      "convertir ce prospect", "transformer le prospect en client", "on a signe avec Sandrine Gomez",
      "convertis le prospect", "Amina devient cliente",
    ],
    keywords: {
      strong: ["convertis", "convertir", "conversion", "transforme", "transformer", "devenu", "devient", "signe"],
      weak: ["passe", "faire"],
    },
    patterns: [
      { re: /\b(convertis|convertir|convertissez|transforme|transformer|transformez)\b/, w: 0.85 },
      { re: /\bconversion (du|de|d|des) (prospect|lead)/, w: 0.9 },
      { re: /\b(est|sont) (devenu|devenue|devenus|devenues) (un |une )?(client|cliente)/, w: 0.9 },
      { re: /\bdevient (un |une )?(client|cliente)\b/, w: 0.85 },
      { re: /\b(passe|passer|faire de) .* (en|un|une) (client|cliente)\b/, w: 0.8 },
      { re: /\b(il|elle|ils|on) a(ons)? signe\b/, w: 0.7 },
    ],
    rules: { prefer: ["prospects"], boost: ["names", "residual", "pronoun"], blockIfPattern: [/\bcombien\b/, /\btaux\b/, /\bpourcentage\b/] },
    slots: [{ name: "cible", required: true, prompt: "Quel prospect voulez-vous convertir en client ?", from: ["names"] }],
  },
  {
    id: "update_status",
    category: "ecriture",
    description: "Changer le statut d'un client, prospect ou opportunite",
    handler: "updateStatus",
    confirm: true,
    examples: [
      "passe l opportunite Migration cloud en gagnee", "marque le client Sophie comme actif", "change le statut de Marie en inactif",
      "l opportunite TechFR est perdue", "mets le prospect Camille en contacte", "mise a jour du statut",
      "modifier le statut", "l affaire est signee", "on a gagne le deal ACME", "on a perdu l opportunite Bernard",
      "passe Marie Dupont en inactif", "mets l opportunite en negociation", "marque cette affaire comme perdue",
    ],
    keywords: {
      strong: ["statut", "marque", "marquer", "mets", "mettre", "change", "changer", "modifie", "modifier", "passe"],
      weak: ["gagne", "perdu", "signe", "inactif", "actif"],
    },
    patterns: [
      { re: /\b(change|changer|modifie|modifier|mets|mettre|passe|passer|marque|marquer|met)\b.*\b(statut|en|comme)\b/, w: 0.55 },
      { re: /\b(change|changer|modifie|modifier|mise a jour|maj|met a jour|mettre a jour) (le |du |de )?statut\b/, w: 0.9 },
      { re: /\bon a (gagne|perdu|signe|remporte|decroche)\b/, w: 0.9 },
      { re: /\b(l |la |le )?(opportunite|affaire|deal|devis|contrat)\b.* (est|a ete|vient d etre|devient|passe) (gagnee?|perdue?|signee?|conclue?|en (negociation|proposition|qualification))/, w: 0.9 },
      { re: /\b(marque|marquer|mets|mettre|passe|passer) .* (comme|en) (gagnee?|perdue?|actif|inactif|contacte|converti|negociation|proposition|qualification|prospection|nouveau)\b/, w: 0.9 },
    ],
    rules: { needs: ["statut"], boost: ["names", "residual", "pronoun"], blockIfPattern: [/\bcombien\b/, /\b(liste|montre|affiche)\b/, /\b(on a|j ai) (cree|ajoute)\b/] },
    slots: [
      { name: "cible", required: true, prompt: "Quel enregistrement voulez-vous modifier ? (donnez son nom ou son intitule)", from: ["names", "title"] },
      { name: "statut", required: true, prompt: "Quel est le nouveau statut ?", from: ["statut"] },
    ],
  },
  {
    id: "delete_record",
    category: "ecriture",
    description: "Supprimer un enregistrement",
    handler: "deleteRecord",
    confirm: true,
    destructive: true,
    examples: [
      "supprime le client Lucas Bernard", "efface le prospect Camille", "retire l opportunite Audit", "supprimer l interaction",
      "enleve le client Jean", "detruis la fiche de Sophie", "elimine ce prospect", "supprime cette opportunite",
      "efface la fiche de Marie Dupont", "je veux supprimer un client", "retirer le prospect de la base",
    ],
    keywords: {
      strong: ["supprime", "supprimer", "efface", "effacer", "retire", "retirer", "enleve", "enlever", "detruis", "elimine", "elimine"],
      weak: ["virer", "jeter"],
    },
    patterns: [
      { re: /\b(supprime|supprimer|supprimez|efface|effacer|effacez|detruis|detruire|elimine|eliminer|enleve|enlever|retire|retirer|vire|virer)\b/, w: 0.85 },
      { re: /\b(je veux|je voudrais|il faut) (supprimer|effacer|retirer|enlever)\b/, w: 0.9 },
    ],
    rules: { boost: ["names", "entityType", "residual", "pronoun"], blockIfPattern: [/\bpas (supprimer|effacer)\b/] },
    slots: [{ name: "cible", required: true, prompt: "Quel enregistrement voulez-vous supprimer ? (donnez son nom ou son intitule)", from: ["names", "title"] }],
  },
];
