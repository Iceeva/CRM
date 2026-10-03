/**
 * chatbot/engine/resolver.js - Resolution d'une reference vers un enregistrement
 * ----------------------------------------------------------------------------
 * Transforme "Marie Dupont", "marie dupond" (faute), "chez ACME", "marie@acme.com",
 * "l'opportunite Audit" ou "lui" en un enregistrement precis de la base.
 *
 *   1. Termes candidats : email, noms propres, entreprise, intitule, mots residuels
 *   2. Recherche exacte "contient" via le stockage (Neon ou JSON)
 *   3. Sinon recherche floue : Jaro-Winkler + Damerau-Levenshtein sur les
 *      champs nom / entreprise / titre / email
 *   4. Pronoms ("lui", "ce client") : dernier enregistrement evoque dans la conversation
 *
 * Le resultat indique si la reference est NON AMBIGUE ("resolved"), ambigue
 * ("ambiguous", plusieurs candidats proches) ou introuvable ("none").
 */
const storage = require("../../services/storageService");
const { jaroWinkler, similarity } = require("../nlp/similarity");
const { stripAccents } = require("../nlp/normalize");

const TYPES = ["clients", "prospects", "opportunities"];
const FIELDS_BY_TYPE = {
  clients: ["nom", "entreprise", "email"],
  prospects: ["nom", "entreprise", "email"],
  opportunities: ["titre"],
  interactions: ["sujet"],
};

const norm = (s) => stripAccents(String(s || "").toLowerCase()).replace(/[^a-z0-9@. ]/g, " ").replace(/\s+/g, " ").trim();

/** Score 0..1 entre un terme et un enregistrement. */
function scoreRecord(type, record, term) {
  const t = norm(term);
  if (!t) return 0;
  let best = 0;
  for (const f of FIELDS_BY_TYPE[type] || []) {
    const v = norm(record[f]);
    if (!v) continue;
    if (v === t) return 1;
    if (v.includes(t) && t.length >= 3) best = Math.max(best, 0.9 + Math.min(0.09, t.length / v.length / 10));
    else if (t.includes(v) && v.length >= 4) best = Math.max(best, 0.88);
    // mot par mot : "dupont" retrouve "Marie Dupont"
    const vWords = v.split(" ");
    const tWords = t.split(" ");
    const wordHits = tWords.filter((w) => w.length >= 3 && vWords.some((x) => x === w || jaroWinkler(w, x) >= 0.92)).length;
    if (wordHits && wordHits === tWords.filter((w) => w.length >= 3).length) best = Math.max(best, 0.8 + 0.05 * wordHits);
    best = Math.max(best, jaroWinkler(t, v) * 0.97, similarity(t, v) * 0.97);
  }
  return best;
}

/** Termes de recherche, du plus fiable au moins fiable. */
function candidateTerms(entities, { allowResidual = true } = {}) {
  const terms = [];
  const add = (t) => {
    const x = String(t || "").trim();
    if (x.length >= 2 && !terms.some((y) => norm(y) === norm(x))) terms.push(x);
  };
  (entities.emails || []).forEach(add);
  (entities.names || []).forEach(add);
  if (entities.company) add(entities.company);
  if (entities.title) add(entities.title);
  (entities.quoted || []).forEach(add);
  if (allowResidual && entities.residual && entities.residual.length) {
    add(entities.residual.join(" "));
    entities.residual.filter((w) => w.length >= 4).forEach(add);
  }
  return terms;
}

/**
 * @param {object} entities
 * @param {{ types?: string[], state?: object, allowResidual?: boolean }} [opts]
 * @returns {Promise<{status: "resolved"|"ambiguous"|"none", match?: object, matches: object[], term?: string}>}
 */
async function resolveRecord(entities, { types, state, allowResidual = true } = {}) {
  const searchTypes = types && types.length ? types : entities.entityType && TYPES.includes(entities.entityType) ? [entities.entityType] : TYPES;

  // Pronom ou "ce client" : on reprend le dernier enregistrement evoque
  const terms = candidateTerms(entities, { allowResidual });
  if (!terms.length && state && state.lastRecord && (entities.pronoun || !terms.length)) {
    const ref = state.lastRecord;
    if (!types || !types.length || types.includes(ref.type)) {
      const rec = await storage.findById(ref.type, ref.id);
      if (rec) {
        const m = { type: ref.type, record: rec, score: 1 };
        return { status: "resolved", match: m, matches: [m], term: "(dernier enregistrement)" };
      }
    }
  }
  if (!terms.length) return { status: "none", matches: [] };

  const pool = {};
  const loadAll = async (type) => {
    if (!pool[type]) pool[type] = (await storage.findAll(type, { limit: 500, page: 1 })).data;
    return pool[type];
  };

  for (const term of terms) {
    const found = new Map();

    // 1. recherche "contient" (rapide, utilise l'index / filtre cote base)
    for (const type of searchTypes) {
      const { data } = await storage.findAll(type, { search: term, limit: 20 });
      data.forEach((r) => found.set(`${type}:${r.id}`, { type, record: r, score: scoreRecord(type, r, term) }));
    }
    // 2. recherche floue (fautes de frappe) si rien de convaincant
    if (![...found.values()].some((m) => m.score >= 0.85)) {
      for (const type of searchTypes) {
        const all = await loadAll(type);
        all.forEach((r) => {
          const score = scoreRecord(type, r, term);
          if (score >= 0.8) found.set(`${type}:${r.id}`, { type, record: r, score });
        });
      }
    }

    const matches = [...found.values()].filter((m) => m.score >= 0.8).sort((a, b) => b.score - a.score);
    if (!matches.length) continue;

    const [first, second] = matches;
    const clear = matches.length === 1 || first.score >= 0.97 || first.score - second.score >= 0.07;
    if (clear) return { status: "resolved", match: first, matches: matches.slice(0, 5), term };
    return { status: "ambiguous", matches: matches.filter((m) => first.score - m.score < 0.07).slice(0, 5), term };
  }
  return { status: "none", matches: [], term: terms[0] };
}

module.exports = { resolveRecord, candidateTerms, scoreRecord };
