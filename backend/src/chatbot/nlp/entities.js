/**
 * chatbot/nlp/entities.js - Extraction d'entites metier
 * ----------------------------------------------------------------------------
 * A partir d'une phrase, reconnait les "slots" dont les handlers ont besoin :
 *
 *   entityType      clients | prospects | opportunities | interactions
 *   statut          valeur de statut reconnue (+ famille : "ouvertes")
 *   interactionType appel | email | reunion | note
 *   field           email | telephone | entreprise | notes | statut | montant | source | date_cloture
 *   emails, phones  valeurs extraites par expression reguliere
 *   amounts / amountConstraint / count / date / period
 *   names           noms propres (majuscules, guillemets, "chez X")
 *   company         entreprise citee
 *   title           intitule (guillemets, "intitule", "nomme", "appele")
 *   residual        mots inconnus du vocabulaire (candidats pour une recherche floue)
 *   sort            desc | asc   ("plus gros", "plus recent", "plus petit")
 *   pronoun         true si la phrase renvoie a un element precedent ("lui", "ce client")
 *   yes / no        reponses courtes de confirmation
 *
 * Chaque valeur reconnue est accompagnee de sa source pour le debug.
 */
const { analyze } = require("./tokenizer");
const { stripAccents } = require("./normalize");
const { fuzzyTokenScore } = require("./similarity");
const { extractAmounts, extractAmountConstraint, extractCount } = require("./numbers");
const { extractDate, extractPeriod } = require("./dates");

const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:\+|00)?\d[\d .\-()]{7,16}\d/g;

/* ------------------------------------------------------------------ */
/*  Dictionnaires de synonymes (formes SANS accents, racines tolerees) */
/* ------------------------------------------------------------------ */

const ENTITY_TYPES = {
  clients: ["client", "clients", "cliente", "clientes", "clientele", "customer", "customers", "acheteur", "acheteurs"],
  prospects: ["prospect", "prospects", "prospecte", "lead", "leads", "piste", "pistes", "contact potentiel", "contacts potentiels", "candidat client"],
  opportunities: [
    "opportunite", "opportunites", "affaire", "affaires", "deal", "deals", "vente", "ventes",
    "pipeline", "devis", "proposition commerciale", "propositions commerciales", "contrat", "contrats", "offre", "offres", "business",
  ],
  interactions: [
    "interaction", "interactions", "echange", "echanges", "historique", "activite", "activites",
    "journal", "suivi", "suivis", "communication", "communications",
  ],
};

const INTERACTION_TYPES = {
  appel: ["appel", "appels", "appeler", "appelle", "coup de fil", "call"],
  email: ["email", "emails", "mail", "mails", "courriel", "courriels", "e mail"],
  reunion: ["reunion", "reunions", "rendez vous", "rdv", "meeting", "visio", "entretien", "rencontre", "demo", "atelier"],
  note: ["note", "notes", "memo", "commentaire", "remarque", "compte rendu"],
};

/** statut -> synonymes ; "scope" precise a quelle ressource le statut s'applique. */
const STATUTS = [
  { value: "actif", scope: "clients", words: ["actif", "actifs", "active", "actives", "en activite"] },
  { value: "inactif", scope: "clients", words: ["inactif", "inactifs", "inactive", "inactives", "dormant", "dormants", "perdu de vue", "inactivite"] },
  { value: "nouveau", scope: "prospects", words: ["nouveau", "nouveaux", "nouvelle", "nouvelles", "recent", "recents", "jamais contacte", "pas encore contacte"] },
  { value: "contacte", scope: "prospects", words: ["contacte", "contactes", "contactee", "contactees", "deja contacte", "deja contactes", "en contact"] },
  { value: "converti", scope: "prospects", words: ["converti", "convertis", "convertie", "converties", "transforme", "transformes"] },
  { value: "prospection", scope: "opportunities", words: ["prospection", "en prospection"] },
  { value: "qualification", scope: "opportunities", words: ["qualification", "en qualification", "qualifie", "qualifies", "a qualifier"] },
  { value: "proposition", scope: "opportunities", words: ["proposition", "en proposition", "propose", "proposes", "devis envoye", "devis envoyes"] },
  { value: "negociation", scope: "opportunities", words: ["negociation", "en negociation", "negocie", "negocies", "negocier"] },
  { value: "gagnee", scope: "opportunities", words: ["gagnee", "gagnees", "gagne", "gagnes", "remporte", "remportee", "remportees", "remportes", "signe", "signee", "signees", "signes", "won", "conclue", "conclues", "reussie", "reussies", "ca gagne"] },
  { value: "perdue", scope: "opportunities", words: ["perdue", "perdues", "perdu", "perdus", "echoue", "echouee", "echouees", "lost", "abandonnee", "abandonnees", "refusee", "refusees"] },
];

/** Famille "ouvertes" : pipeline non conclu. */
const OPEN_WORDS = ["ouverte", "ouvertes", "ouvert", "ouverts", "en cours", "actuelle", "actuelles", "a traiter", "non conclue", "non conclues", "encore ouvertes", "en attente", "restantes", "restant"];

const FIELDS = {
  email: ["email", "mail", "courriel", "adresse mail", "adresse email", "e mail", "adresse electronique"],
  telephone: ["telephone", "numero", "tel", "portable", "mobile", "gsm", "numero de telephone", "contact telephonique", "coordonnees telephoniques"],
  entreprise: ["entreprise", "societe", "boite", "compagnie", "organisation", "structure", "firme"],
  notes: ["notes", "note", "remarques", "commentaires", "commentaire", "observations"],
  statut: ["statut", "etat", "situation"],
  montant: ["montant", "valeur", "prix", "budget", "somme", "tarif"],
  source: ["source", "origine", "provenance", "canal"],
  date_cloture: ["date de cloture", "cloture", "echeance", "deadline", "date limite"],
};

const PRONOUNS = ["lui", "elle", "celui ci", "celle ci", "ce client", "cette cliente", "ce prospect", "cette prospecte", "cette opportunite", "cette affaire", "ce deal", "le meme", "la meme", "eux", "ceux ci", "ceux la", "celui la", "celle la", "ses coordonnees", "son email", "son telephone", "son mail", "sa fiche", "ses infos", "ses informations"];

const YES = ["oui", "ok", "d accord", "confirme", "confirmer", "valide", "valider", "vas y", "go", "exact", "parfait", "bien sur", "certainement", "absolument", "carrement", "evidemment", "c est bon", "ca marche", "je confirme", "affirmatif", "volontiers", "avec plaisir", "allez y"];
const NO = ["non", "annule", "annuler", "stop", "laisse tomber", "laisser tomber", "pas maintenant", "plus tard", "negatif", "finalement non", "oublie", "oublier", "arrete", "arreter", "abandonne", "abandonner", "surtout pas", "jamais"];

const SORT_DESC = ["plus gros", "plus grosse", "plus grosses", "plus gros", "plus important", "plus importante", "plus importantes", "plus eleve", "plus elevee", "plus recent", "plus recente", "plus recents", "plus recentes", "dernier", "derniere", "derniers", "dernieres", "meilleur", "meilleure", "meilleurs", "meilleures", "top", "maximum", "plus grand", "plus grande", "recemment"];
const SORT_ASC = ["plus petit", "plus petite", "plus petites", "plus ancien", "plus ancienne", "plus anciens", "plus anciennes", "premier", "premiere", "premiers", "premieres", "minimum", "moins eleve", "moins elevee", "plus faible", "plus faibles", "pire", "pires"];

/* ------------------------------------------------------------------ */
/*  Utilitaires                                                        */
/* ------------------------------------------------------------------ */

/** Cherche une expression (mot ou suite de mots) dans le texte normalise, avec limites de mots. */
function hasPhrase(clean, phrase) {
  return new RegExp(`(?:^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`).test(clean);
}

/** Meme chose, avec tolerance aux fautes de frappe pour les mots d'un seul token (>= 5 lettres). */
function hasPhraseFuzzy(clean, tokens, phrase) {
  if (hasPhrase(clean, phrase)) return true;
  if (phrase.includes(" ") || phrase.length < 5) return false;
  // Pas de regle de prefixe ici : "prospect" ne doit pas etre pris pour "prospection"
  return tokens.some((t) => t.length >= 5 && fuzzyTokenScore(t, phrase, { prefix: false }) >= 0.8);
}

/** Retourne le premier groupe dont l'un des mots est present. */
function findGroup(clean, tokens, groups, { fuzzy = true } = {}) {
  let best = null;
  for (const [key, words] of Object.entries(groups)) {
    for (const w of words) {
      const hit = fuzzy ? hasPhraseFuzzy(clean, tokens, w) : hasPhrase(clean, w);
      if (hit) {
        const score = w.length + (hasPhrase(clean, w) ? 100 : 0); // exact > flou, long > court
        if (!best || score > best.score) best = { key, word: w, score };
      }
    }
  }
  return best;
}

function matchEmails(raw) {
  return [...new Set((raw.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))];
}

function matchPhones(raw) {
  const withoutEmails = raw.replace(EMAIL_RE, " ");
  return (withoutEmails.match(PHONE_RE) || [])
    .map((p) => p.trim())
    .filter((p) => p.replace(/\D/g, "").length >= 8 && !/^\d{4}-\d{2}-\d{2}$/.test(p) && !/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(p))
    .map((p) => p.replace(/\s+/g, " "));
}

/** Mots capitalises frequents en debut de phrase qui ne sont pas des noms propres. */
const NOT_NAMES = new Set(
  (
    "Combien Quel Quelle Quels Quelles Quand Comment Pourquoi Qui Quoi Ou Montre Montrez Affiche Affichez Donne Donnez " +
    "Liste Listez Cherche Cherchez Trouve Trouvez Ajoute Ajoutez Cree Creez Creer Ajouter Supprime Supprimez Supprimer Modifie " +
    "Modifiez Passe Passez Convertis Convertissez Convertir Bonjour Bonsoir Salut Merci Oui Non Ok Aide Aidez Je Tu Il Elle Nous " +
    "Vous Ils Elles On Le La Les Un Une Des Du De Est Sont Ai As Avons Avez Ont Mon Ma Mes Notre Nos Peux Peut Pouvez Veux Voudrais " +
    "Aller Va Vas Allez Ouvre Ouvrez Retourne Retournez Estce Cest Ce Cet Cette Ces Pour Avec Sans Sur Dans Chez Par Et Ou Mais Donc " +
    "Resume Resumez Statistiques Statistique Stats Pipeline Clients Client Prospects Prospect Opportunites Opportunite Interactions Interaction " +
    "Email Telephone Entreprise Notes Note Appel Reunion Mail Hier Demain Aujourd Lundi Mardi Mercredi Jeudi Vendredi Samedi Dimanche " +
    "Janvier Fevrier Mars Avril Mai Juin Juillet Aout Septembre Octobre Novembre Decembre Euros Euro Dis Dites Fais Faites Enregistre " +
    "Note Noter Planifie Programme Rappelle Rappelez Relance Relancer Quels Tous Toutes Tout Toute Y Aurais Aurait Serait Existe Mets Mettez"
  ).split(/\s+/)
);

const NAME_PARTICLES = new Set(["de", "du", "da", "di", "van", "von", "el", "al", "le", "la", "ben", "bin", "dos", "des", "d'", "mc", "mac"]);

/**
 * Noms propres : suites de mots commencant par une majuscule (accents inclus),
 * avec particules (de, du, van...). Ignore les mots-outils capitalises en debut de phrase.
 */
function extractProperNames(raw) {
  const names = [];
  const re = /(?:\p{Lu}[\p{L}'\u2019-]*)(?:\s+(?:(?:de|du|da|di|van|von|el|al|le|la|ben|bin|dos|des)\s+)?\p{Lu}[\p{L}'\u2019-]*)*/gu;
  let m;
  while ((m = re.exec(raw))) {
    let words = m[0].split(/\s+/);
    // retire les mots-outils en tete (ex: "Ajoute Marie Dupont")
    while (words.length && NOT_NAMES.has(stripAccents(words[0]))) words.shift();
    // et en queue
    while (words.length && NOT_NAMES.has(stripAccents(words[words.length - 1]))) words.pop();
    if (!words.length) continue;
    const name = words.join(" ");
    if (name.length < 2) continue;
    names.push(name);
  }
  return [...new Set(names)];
}

/** Texte entre guillemets (droits, typographiques) ou apostrophes encadrant plusieurs mots. */
function extractQuoted(raw) {
  const out = [];
  const re = /["\u201C\u00AB]\s*([^"\u201D\u00BB]{2,120}?)\s*["\u201D\u00BB]/g;
  let m;
  while ((m = re.exec(raw))) out.push(m[1].trim());
  return out;
}

/** Entreprise : "chez X", "de la societe X", "entreprise X", "societe X". */
function extractCompany(raw) {
  const re = /\b(?:chez|societe|société|entreprise|boite|boîte|compagnie|de la societe|de la société|de l'entreprise|de l’entreprise)\s+(?:la\s+|le\s+|l['\u2019]\s*)?((?:\p{Lu}|\d)[\p{L}\d&.'\u2019\-]*(?:\s+(?:\p{Lu}|\d)[\p{L}\d&.'\u2019\-]*)*)/u;
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}

/** Intitule : guillemets, ou "intitule/titre/nomme/appele/libelle X". */
function extractTitle(raw) {
  const quoted = extractQuoted(raw);
  if (quoted.length) return quoted[0];
  const m = raw.match(/\b(?:intitul[ée]e?|titre|nomm[ée]e?|appel[ée]e?|libell[ée]|sujet|objet|pour|concernant)\s*:?\s+([^,.;!?\n]{3,100})/i);
  if (m) {
    const t = m[1].replace(/\s+(?:de|d['\u2019]|a|à|avec|pour|montant|statut|client|prospect|aupres)\b.*$/i, "").trim();
    if (t.length >= 3) return t;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Extraction principale                                              */
/* ------------------------------------------------------------------ */

/**
 * @param {string} text texte brut utilisateur
 * @param {{ now?: Date, knownStems?: Set<string> }} [opts]
 */
function extractEntities(text, { now = new Date(), knownStems = new Set() } = {}) {
  const a = analyze(text);
  const { raw, stems } = a;
  // "chiffre d'affaires" contient le mot "affaires" : on le neutralise pour ne pas
  // le prendre pour une opportunite
  const clean = a.clean.replace(/\bchiffre d affaires?\b/g, "chiffre_affaires");
  const tokens = clean.split(" ").filter(Boolean);
  const out = { _sources: {} };
  const src = (k, v) => (out._sources[k] = v);

  // --- type de ressource
  const typeHit = findGroup(clean, tokens, ENTITY_TYPES);
  if (typeHit) {
    out.entityType = typeHit.key;
    src("entityType", typeHit.word);
    // toutes les ressources mentionnees (utile pour "clients et prospects")
    out.entityTypes = Object.entries(ENTITY_TYPES)
      .filter(([, words]) => words.some((w) => hasPhraseFuzzy(clean, tokens, w)))
      .map(([k]) => k);
  }

  // --- type d'interaction (hors "interactions" generique)
  const itHit = findGroup(clean, tokens, INTERACTION_TYPES);
  if (itHit) {
    out.interactionType = itHit.key;
    src("interactionType", itHit.word);
  }

  // --- statut (le plus specifique, selon la ressource mentionnee si possible)
  const statutHits = [];
  for (const s of STATUTS) {
    for (const w of s.words) {
      if (hasPhrase(clean, w) || hasPhraseFuzzy(clean, tokens, w)) {
        statutHits.push({ ...s, word: w, exact: hasPhrase(clean, w) });
        break;
      }
    }
  }
  if (statutHits.length) {
    const preferred = statutHits
      .filter((h) => !out.entityType || h.scope === out.entityType || ["nouveau"].includes(h.value))
      .sort((x, y) => Number(y.exact) - Number(x.exact) || y.word.length - x.word.length);
    const chosen = preferred[0] || statutHits[0];
    // "nouveau client" : "nouveau" qualifie un ajout, pas un statut de prospect
    const isCreationWord = chosen.value === "nouveau" && /\b(?:ajout|cre|nouv)\w*\s+(?:un |une |le |la )?nouv/.test(clean);
    if (!isCreationWord) {
      out.statut = chosen.value;
      out.statutScope = chosen.scope;
      src("statut", chosen.word);
    }
  }
  if (OPEN_WORDS.some((w) => hasPhrase(clean, w)) && !out.statut) {
    out.statut = "ouvertes";
    out.statutScope = "opportunities";
    src("statut", "famille ouvertes");
  }

  // --- champ demande
  const fieldHit = findGroup(clean, tokens, FIELDS);
  if (fieldHit) {
    out.field = fieldHit.key;
    src("field", fieldHit.word);
  }

  // --- coordonnees brutes
  const emails = matchEmails(raw);
  if (emails.length) out.emails = emails;
  const phones = matchPhones(raw);
  if (phones.length) out.phones = phones;

  // --- nombres, dates
  const amounts = extractAmounts(raw);
  if (amounts.length) {
    out.amounts = amounts.map((x) => x.value);
    out.amount = amounts[0].value;
  }
  const constraint = extractAmountConstraint(raw);
  if (constraint) out.amountConstraint = constraint;
  const count = extractCount(raw);
  if (count) out.count = count;

  const period = extractPeriod(raw, now);
  if (period) {
    out.period = period;
    src("period", period.label);
  }
  const date = extractDate(raw, now);
  if (date) {
    out.date = date.iso;
    src("date", date.source);
  }

  // --- noms propres, entreprise, titre
  const quoted = extractQuoted(raw);
  if (quoted.length) out.quoted = quoted;
  const company = extractCompany(raw);
  if (company) out.company = company;
  const title = extractTitle(raw);
  let names = extractProperNames(raw).filter((n) => !emails.some((e) => e.includes(n.toLowerCase())));
  if (company) names = names.filter((n) => n !== company);
  // Un mot capitalise qui fait partie d'un intitule entre guillemets n'est pas un nom de personne
  if (quoted.length) names = names.filter((n) => !quoted.some((q) => q.toLowerCase().includes(n.toLowerCase())));
  if (names.length) out.names = names;
  if (title) out.title = title;

  // --- tri
  // "le mois dernier" ou "les 7 derniers jours" sont des periodes, pas des tris
  const sortText = clean
    .replace(/\b(?:mois|semaine|annee|an|trimestre|jour|jours|semaines|ans)s? (?:dernier|derniere|derniers|dernieres|passe|prochain)\b/g, " ")
    .replace(/\b(?:dernier|derniere|derniers|dernieres)s? (?:jours?|semaines?|mois|ans?|annees?)\b/g, " ");
  if (SORT_ASC.some((w) => hasPhrase(sortText, w))) out.sort = "asc";
  else if (SORT_DESC.some((w) => hasPhrase(sortText, w))) out.sort = "desc";

  // --- renvoi a un element precedent
  if (PRONOUNS.some((w) => hasPhrase(clean, w))) out.pronoun = true;

  // --- oui / non (reponses courtes uniquement, pour eviter "non" dans une vraie phrase)
  const shortAnswer = tokens.length <= 5;
  if (shortAnswer) {
    if (YES.some((w) => hasPhrase(clean, w))) out.yes = true;
    if (NO.some((w) => hasPhrase(clean, w))) out.no = true;
    if (out.yes && out.no) {
      // "non ok" : la negation l'emporte
      out.yes = false;
    }
  }

  // --- mots residuels : candidats pour une recherche floue dans la base
  const residual = [];
  tokens.forEach((t, i) => {
    if (t.length < 3 || /^\d+$/.test(t) || t.includes("@")) return;
    if (knownStems.has(stems[i]) || knownStems.has(t)) return;
    residual.push(t);
  });
  if (residual.length) out.residual = residual;

  return out;
}

module.exports = {
  extractEntities,
  extractProperNames,
  extractQuoted,
  extractCompany,
  extractTitle,
  matchEmails,
  matchPhones,
  hasPhrase,
  ENTITY_TYPES,
  INTERACTION_TYPES,
  STATUTS,
  FIELDS,
  OPEN_WORDS,
  YES,
  NO,
};
