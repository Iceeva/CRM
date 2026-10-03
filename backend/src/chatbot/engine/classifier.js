/**
 * chatbot/engine/classifier.js - Classifieur d'intentions hybride
 * ----------------------------------------------------------------------------
 * Chaque intention recoit un score compose de QUATRE signaux independants :
 *
 *  1. LEXICAL  (lex)  : similarite de Dice ponderee par l'IDF entre la phrase et
 *                       chacun des exemples d'entrainement. Tolere les fautes de
 *                       frappe (Damerau-Levenshtein) et les variations morphologiques
 *                       (racinisation). Les mots rares (pipeline, relancer) pesent plus
 *                       que les mots frequents (client, liste).
 *  2. MOTS-CLES (kw)  : mots-cles forts (+0.30) et faibles (+0.10), plafonnes a 1.
 *  3. PATRONS  (pat)  : expressions regulieres precises, combinees en "OU bruite"
 *                       (1 - produit(1 - w)) : deux patrons se renforcent sans depasser 1.
 *  4. ENTITES  (adj)  : coherence avec les entites extraites (type de ressource,
 *                       statut, nom, champ...) : bonus, malus, interdictions.
 *
 *     total = 0.42 * lex + 0.22 * kw + 0.46 * pat + adj
 *
 * Les scores sont ensuite convertis en probabilites (softmax) et en confiance
 * combinant le niveau absolu du meilleur score ET son avance sur le second.
 *
 * Les noms propres, entreprises et textes entre guillemets sont MASQUES avant
 * la classification : une entreprise appelee "Nouveau Monde" ne declenche pas
 * l'intention "creer un nouveau ...".
 */
const { analyze } = require("../nlp/tokenizer");
const { stem } = require("../nlp/stemmer");
const { fuzzyTokenScore } = require("../nlp/similarity");
const { isStopword, STOPWORDS } = require("../nlp/stopwords");
const { extractEntities, extractProperNames, ENTITY_TYPES, INTERACTION_TYPES, STATUTS, FIELDS, OPEN_WORDS, YES, NO } = require("../nlp/entities");
const { INTENTS, CONFUSABLE_GROUPS } = require("../intents");

const WEIGHTS = { lex: 0.42, kw: 0.22, pat: 0.46 };
const FUZZY_MIN = 0.8;

/* ------------------------------------------------------------------ */
/*  Construction du modele (une seule fois, au chargement du module)   */
/* ------------------------------------------------------------------ */

function buildModel() {
  const docs = []; // { intentId, stems:Set, tokens:[], idfWeights:[] }

  for (const intent of INTENTS) {
    for (const ex of intent.examples) {
      const a = analyze(ex);
      // Les noms propres d'exemple (Marie Dupont) ne doivent pas peser dans le lexique
      const names = extractProperNames(ex).flatMap((n) => analyze(n).tokens);
      const nameSet = new Set(names);
      const tokens = a.content.filter((t) => !nameSet.has(t));
      docs.push({ intentId: intent.id, tokens, stems: tokens.map(stem) });
    }
  }

  // IDF : log((N + 1) / (df + 1)) + 1  (df = nb d'exemples contenant la racine)
  const df = new Map();
  for (const d of docs) for (const s of new Set(d.stems)) df.set(s, (df.get(s) || 0) + 1);
  const N = docs.length;
  const idf = (s) => Math.log((N + 1) / ((df.get(s) || 0) + 1)) + 1;
  docs.forEach((d) => {
    d.weights = d.stems.map(idf);
    d.total = d.weights.reduce((x, y) => x + y, 0);
  });

  // Mots-cles racinises
  const keywordModels = {};
  for (const intent of INTENTS) {
    const compile = (list) =>
      list.map((w) => {
        const a = analyze(w);
        return { word: a.clean, multi: a.tokens.length > 1, stem: a.stems.join(" "), token: a.tokens[0] };
      });
    keywordModels[intent.id] = {
      strong: compile(intent.keywords.strong || []),
      weak: compile(intent.keywords.weak || []),
    };
  }

  // Vocabulaire connu : tout ce qui n'est pas dans cette liste est un mot "residuel"
  // (candidat nom propre / mot libre) pour la recherche floue en base.
  const known = new Set();
  const addWords = (words) =>
    words.forEach((w) => {
      const a = analyze(w);
      a.tokens.forEach((t, i) => {
        known.add(t);
        known.add(a.stems[i]);
      });
    });
  docs.forEach((d) => {
    d.tokens.forEach((t) => known.add(t));
    d.stems.forEach((s) => known.add(s));
  });
  Object.values(ENTITY_TYPES).forEach(addWords);
  Object.values(INTERACTION_TYPES).forEach(addWords);
  Object.values(FIELDS).forEach(addWords);
  STATUTS.forEach((s) => addWords(s.words));
  addWords(OPEN_WORDS);
  addWords(YES);
  addWords(NO);
  addWords(["aujourd hui", "hier", "demain", "semaine", "mois", "annee", "dernier", "derniere", "prochain", "jour", "jours", "cette", "euros", "euro", "plus", "moins", "entre", "tous", "toutes"]);
  STOPWORDS.forEach((w) => known.add(w));
  for (const k of Object.values(keywordModels)) [...k.strong, ...k.weak].forEach((m) => { known.add(m.token); known.add(m.stem); });

  return { docs, idf, keywordModels, known };
}

const MODEL = buildModel();

/* ------------------------------------------------------------------ */
/*  Aides                                                              */
/* ------------------------------------------------------------------ */

/** Remplace noms, entreprises et intitules par un marqueur neutre dans le texte normalise. */
function maskClean(a, entities) {
  let masked = a.clean;
  const spans = [...(entities.names || []), ...(entities.company ? [entities.company] : []), ...(entities.quoted || [])];
  for (const s of spans) {
    const c = analyze(s).clean;
    if (c) masked = masked.split(c).join(" xname ");
  }
  masked = masked.replace(/\S+@\S+/g, " xemail ").replace(/\s+/g, " ").trim();
  return masked;
}

/** Mots interrogatifs trop generiques pour porter une intention (ignores par le signal lexical). */
const LEXICAL_STOP = new Set(["quel", "quelle", "quels", "quelles", "dire", "dis", "peut", "ca", "ce", "cela"]);

/** Tokens contenu apres masquage. */
function maskedContent(masked) {
  return masked
    .split(" ")
    .filter((t) => t && t !== "xname" && t !== "xemail" && !isStopword(t) && !LEXICAL_STOP.has(t));
}

/** Meilleure correspondance floue d'un token parmi une liste. */
function bestMatch(token, tokenStem, candidates) {
  let best = 0;
  for (let i = 0; i < candidates.tokens.length; i++) {
    if (candidates.stems[i] === tokenStem) return 1;
    if (candidates.tokens[i] === token) return 1;
    const s = fuzzyTokenScore(token, candidates.tokens[i]);
    if (s >= FUZZY_MIN && s > best) best = s;
  }
  return best;
}

/** Signal 1 : similarite de Dice ponderee, max sur les exemples. */
function lexicalScore(userTokens) {
  if (!userTokens.length) return {};
  const userStems = userTokens.map(stem);
  const userWeights = userStems.map(MODEL.idf);
  const wU = userWeights.reduce((x, y) => x + y, 0);

  const perIntent = {};
  for (const d of MODEL.docs) {
    let mUE = 0;
    userTokens.forEach((t, i) => {
      mUE += userWeights[i] * bestMatch(t, userStems[i], d);
    });
    let mEU = 0;
    d.tokens.forEach((t, i) => {
      mEU += d.weights[i] * bestMatch(t, d.stems[i], { tokens: userTokens, stems: userStems });
    });
    const sim = d.total + wU > 0 ? (mUE + mEU) / (d.total + wU) : 0;
    (perIntent[d.intentId] = perIntent[d.intentId] || []).push(sim);
  }

  const out = {};
  for (const [id, sims] of Object.entries(perIntent)) {
    sims.sort((a, b) => b - a);
    const top3 = sims.slice(0, 3);
    const avg = top3.reduce((x, y) => x + y, 0) / top3.length;
    out[id] = 0.75 * sims[0] + 0.25 * avg;
  }
  return out;
}

/** Signal 2 : mots-cles forts / faibles. */
function keywordScore(intentId, masked, userTokens) {
  const km = MODEL.keywordModels[intentId];
  const userStems = userTokens.map(stem);
  const hit = (m) => {
    if (m.multi) return new RegExp(`(?:^|\\s)${m.word}(?=\\s|$)`).test(masked);
    for (let i = 0; i < userTokens.length; i++) {
      if (userStems[i] === m.stem || userTokens[i] === m.token) return true;
      if (m.token.length >= 5 && fuzzyTokenScore(userTokens[i], m.token, { prefix: false }) >= FUZZY_MIN) return true;
    }
    return false;
  };
  const strong = km.strong.filter(hit).length;
  const weak = km.weak.filter(hit).length;
  return Math.min(1, strong * 0.3 + weak * 0.1);
}

/** Signal 3 : patrons, combines en OU bruite. */
function patternScore(intent, masked) {
  let miss = 1;
  const matched = [];
  for (const p of intent.patterns || []) {
    if (p.re.test(masked)) {
      miss *= 1 - p.w;
      matched.push(String(p.re));
    }
  }
  return { score: 1 - miss, matched };
}

/** Signal 4 : coherence avec les entites. */
function entityAdjust(intent, e, masked, tokenCount) {
  const r = intent.rules || {};
  let adj = 0;
  const notes = [];
  const has = (k) => {
    if (k === "amountConstraintMoney") return Boolean(e.amountConstraint);
    if (k === "count_only") return false;
    return e[k] !== undefined && e[k] !== null && !(Array.isArray(e[k]) && !e[k].length);
  };

  // Types de ressource preferes / rejetes
  if (r.prefer && e.entityType) {
    if (r.prefer.includes(e.entityType)) { adj += 0.18; notes.push("+type"); }
    else if (r.reject === undefined) { adj -= 0.06; notes.push("-type"); }
  }
  for (const k of r.reject || []) {
    if (e.entityType === k || (e.entityTypes || []).includes(k) || (!["clients", "prospects", "opportunities", "interactions"].includes(k) && has(k))) {
      adj -= 0.35;
      notes.push(`-rejet:${k}`);
      break;
    }
  }
  // Entites obligatoires
  for (const k of r.needs || []) {
    if (has(k) || (k === "names" && (e.residual || []).length)) adj += 0.06;
    else { adj -= 0.18; notes.push(`-manque:${k}`); }
  }
  // Bonus (plafonne) et malus
  let bonus = 0;
  for (const k of r.boost || []) if (has(k)) bonus += 0.07;
  adj += Math.min(0.2, bonus);
  for (const k of r.penalize || []) if (has(k)) { adj -= 0.1; notes.push(`-pen:${k}`); }
  // Intentions sociales : refusent certaines entites metier
  for (const k of r.rejectEntities || []) if (has(k)) { adj -= 0.4; notes.push(`-social:${k}`); break; }
  // Longueur : les formules sociales sont courtes
  if (r.maxTokens && tokenCount > r.maxTokens) { adj -= 0.35; notes.push("-long"); }
  // Interdictions par motif
  for (const re of r.blockIfPattern || []) if (re.test(masked)) { adj -= 1.0; notes.push("-bloque"); break; }

  return { adj, notes };
}

/* ------------------------------------------------------------------ */
/*  Classification                                                      */
/* ------------------------------------------------------------------ */

function softmax(values, temperature = 0.1) {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / temperature));
  const sum = exps.reduce((x, y) => x + y, 0);
  return exps.map((x) => x / sum);
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * @param {string} text texte brut
 * @param {{ now?: Date, bias?: Record<string, number>, entities?: object }} [opts]
 *   bias : bonus par intention (contexte de dialogue)
 */
function classify(text, { now = new Date(), bias = {} } = {}) {
  const a = analyze(text);
  const entities = extractEntities(text, { now, knownStems: MODEL.known });
  const masked = maskClean(a, entities);
  const tokens = maskedContent(masked);
  const lex = lexicalScore(tokens);

  const candidates = INTENTS.map((intent) => {
    const kw = keywordScore(intent.id, masked, tokens);
    const pat = patternScore(intent, masked);
    const ea = entityAdjust(intent, entities, masked, a.tokens.length);
    const l = lex[intent.id] || 0;
    const total = Math.max(0, WEIGHTS.lex * l + WEIGHTS.kw * kw + WEIGHTS.pat * pat.score + ea.adj + (bias[intent.id] || 0));
    return { id: intent.id, score: total, lex: l, kw, pat: pat.score, adjust: ea.adj, notes: ea.notes, patterns: pat.matched };
  }).sort((x, y) => y.score - x.score);

  const probs = softmax(candidates.map((c) => c.score));
  candidates.forEach((c, i) => (c.prob = probs[i]));

  const top = candidates[0];
  const second = candidates[1];
  const margin = top.score - (second ? second.score : 0);

  // Confiance : niveau absolu du meilleur score (55 %) + avance sur le second (45 %)
  const confidence = a.tokens.length === 0 ? 0 : clamp01(0.55 * clamp01(top.score / 0.6) + 0.45 * clamp01(margin / 0.2));

  // Ambiguite : deux intentions du meme groupe confondable, tres proches
  let ambiguity = null;
  if (second && margin < 0.1 && top.score > 0.3) {
    const group = CONFUSABLE_GROUPS.find((g) => g.ids.includes(top.id) && g.ids.includes(second.id));
    if (group) {
      const options = candidates.filter((c) => group.ids.includes(c.id) && top.score - c.score < 0.14).map((c) => c.id);
      ambiguity = { group, options };
    }
  }

  return {
    intent: top.id,
    score: top.score,
    confidence,
    margin,
    candidates: candidates.slice(0, 5),
    ambiguity,
    entities,
    analysis: { clean: a.clean, masked, tokens: a.tokens, stems: a.stems },
  };
}

module.exports = { classify, MODEL, WEIGHTS, softmax };
