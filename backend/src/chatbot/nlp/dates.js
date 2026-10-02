/**
 * chatbot/nlp/dates.js - Extraction de dates et de periodes en francais
 * ----------------------------------------------------------------------------
 * Comprend :
 *   - relatives : aujourd'hui, hier, avant-hier, demain, apres-demain
 *   - periodes  : cette semaine, la semaine derniere, ce mois-ci, le mois dernier,
 *                 cette annee, l'annee derniere, ce trimestre
 *   - glissantes: "les 7 derniers jours", "ces 30 derniers jours", "depuis 2 semaines"
 *   - absolues  : 12/10/2026, 12-10-2026, 2026-10-12, "12 octobre 2026", "12 octobre"
 *   - jours     : lundi, mardi... (prochain / dernier)
 *   - mois seul : "en octobre", "en septembre 2026"
 *
 * Toutes les fonctions acceptent `now` pour etre testables.
 */
const { stripAccents } = require("./normalize");

const MONTHS = {
  janvier: 0, janv: 0, fevrier: 1, fevr: 1, fev: 1, mars: 2, avril: 3, avr: 3, mai: 4, juin: 5,
  juillet: 6, juil: 6, aout: 7, septembre: 8, sept: 8, octobre: 9, oct: 9, novembre: 10, nov: 10,
  decembre: 11, dec: 11,
};
const WEEKDAYS = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function validDate(y, m, d) {
  const dt = new Date(y, m, d);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d ? dt : null;
}

function makeRange(from, to, label) {
  return { from: startOfDay(from), to: endOfDay(to), label, fromISO: iso(from), toISO: iso(to) };
}

/**
 * Extrait une periode (intervalle) du texte.
 * @param {string} text texte brut
 * @param {Date} [now]
 * @returns {{from: Date, to: Date, label: string, fromISO: string, toISO: string} | null}
 */
function extractPeriod(text, now = new Date()) {
  const t = stripAccents(String(text).toLowerCase()).replace(/['\u2019]/g, " ").replace(/-/g, " ");
  const today = startOfDay(now);

  // "les 7 derniers jours", "ces 30 derniers jours", "depuis 2 semaines", "sur 3 mois"
  let m = t.match(/\b(?:les|ces|sur les|depuis)?\s*(\d{1,3})\s*(derniers?|dernieres?)?\s*(jours?|semaines?|mois|ans?|annees?)\b/);
  if (m && (m[2] || /depuis|sur/.test(t))) {
    const n = parseInt(m[1], 10);
    const unit = m[3];
    let from = today;
    if (/jour/.test(unit)) from = addDays(today, -(n - 1));
    else if (/semaine/.test(unit)) from = addDays(today, -(n * 7 - 1));
    else if (/mois/.test(unit)) from = new Date(today.getFullYear(), today.getMonth() - n, today.getDate());
    else from = new Date(today.getFullYear() - n, today.getMonth(), today.getDate());
    return makeRange(from, today, `les ${n} derniers ${/jour/.test(unit) ? "jours" : /semaine/.test(unit) ? "semaines" : /mois/.test(unit) ? "mois" : "ans"}`);
  }

  if (/\bavant hier\b/.test(t)) return makeRange(addDays(today, -2), addDays(today, -2), "avant-hier");
  if (/\bapres demain\b/.test(t)) return makeRange(addDays(today, 2), addDays(today, 2), "apres-demain");
  if (/\bhier\b/.test(t)) return makeRange(addDays(today, -1), addDays(today, -1), "hier");
  if (/\bdemain\b/.test(t)) return makeRange(addDays(today, 1), addDays(today, 1), "demain");
  if (/\baujourd hui\b|\bce jour\b|\bce matin\b|\bce soir\b|\bcet apres midi\b/.test(t)) return makeRange(today, today, "aujourd'hui");

  // Semaine : lundi -> dimanche
  const dow = (today.getDay() + 6) % 7; // 0 = lundi
  const monday = addDays(today, -dow);
  if (/\bsemaine (derniere|passee|precedente)\b/.test(t)) return makeRange(addDays(monday, -7), addDays(monday, -1), "la semaine derniere");
  if (/\bsemaine prochaine\b/.test(t)) return makeRange(addDays(monday, 7), addDays(monday, 13), "la semaine prochaine");
  if (/\b(cette|la) semaine\b/.test(t)) return makeRange(monday, addDays(monday, 6), "cette semaine");

  // Mois
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthRange = (y, mo, label) => makeRange(new Date(y, mo, 1), new Date(y, mo + 1, 0), label);
  if (/\bmois (dernier|passe|precedent)\b/.test(t)) {
    const d = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() - 1, 1);
    return monthRange(d.getFullYear(), d.getMonth(), "le mois dernier");
  }
  if (/\bmois prochain\b/.test(t)) {
    const d = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 1);
    return monthRange(d.getFullYear(), d.getMonth(), "le mois prochain");
  }
  if (/\b(ce|le) mois( ci)?\b/.test(t)) return monthRange(today.getFullYear(), today.getMonth(), "ce mois-ci");

  // Trimestre
  if (/\b(ce|le) trimestre\b/.test(t)) {
    const q = Math.floor(today.getMonth() / 3);
    return makeRange(new Date(today.getFullYear(), q * 3, 1), new Date(today.getFullYear(), q * 3 + 3, 0), "ce trimestre");
  }
  if (/\btrimestre (dernier|precedent|passe)\b/.test(t)) {
    const q = Math.floor(today.getMonth() / 3) - 1;
    const y = q < 0 ? today.getFullYear() - 1 : today.getFullYear();
    const qq = (q + 4) % 4;
    return makeRange(new Date(y, qq * 3, 1), new Date(y, qq * 3 + 3, 0), "le trimestre dernier");
  }

  // Annee
  if (/\bannee (derniere|passee|precedente)\b/.test(t)) {
    const y = today.getFullYear() - 1;
    return makeRange(new Date(y, 0, 1), new Date(y, 11, 31), "l'annee derniere");
  }
  if (/\b(cette|l) annee\b/.test(t)) {
    const y = today.getFullYear();
    return makeRange(new Date(y, 0, 1), new Date(y, 11, 31), "cette annee");
  }

  // Mois nomme : "en octobre", "en septembre 2026"
  const mn = t.match(/\b(?:en|de|du mois de|mois de|pour)?\s*(janvier|janv|fevrier|fevr|mars|avril|mai|juin|juillet|juil|aout|septembre|sept|octobre|oct|novembre|nov|decembre|dec)\b(?:\s+(\d{4}))?/);
  if (mn && !/\b\d{1,2}\s+(janvier|janv|fevrier|fevr|mars|avril|mai|juin|juillet|juil|aout|septembre|sept|octobre|oct|novembre|nov|decembre|dec)\b/.test(t)) {
    const y = mn[2] ? parseInt(mn[2], 10) : today.getFullYear();
    return monthRange(y, MONTHS[mn[1]], `${mn[1]} ${y}`);
  }
  return null;
}

/**
 * Extrait une date precise (jour). Retourne la premiere trouvee.
 * @returns {{ date: Date, iso: string, source: string } | null}
 */
function extractDate(text, now = new Date()) {
  const t = stripAccents(String(text).toLowerCase()).replace(/['\u2019]/g, " ");
  const today = startOfDay(now);
  let m;

  // 2026-10-12
  if ((m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) {
    const d = validDate(+m[1], +m[2] - 1, +m[3]);
    if (d) return { date: d, iso: iso(d), source: m[0] };
  }
  // 12/10/2026, 12-10-2026, 12.10.2026, 12/10/26
  if ((m = t.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/))) {
    let y = +m[3];
    if (y < 100) y += 2000;
    const d = validDate(y, +m[2] - 1, +m[1]);
    if (d) return { date: d, iso: iso(d), source: m[0] };
  }
  // 12/10 (annee courante)
  if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})\b(?![\/\d])/))) {
    const d = validDate(today.getFullYear(), +m[2] - 1, +m[1]);
    if (d) return { date: d, iso: iso(d), source: m[0] };
  }
  // 12 octobre 2026 / 12 octobre / 1er octobre
  if ((m = t.match(/\b(\d{1,2})(?:er)?\s+(janvier|janv|fevrier|fevr|mars|avril|mai|juin|juillet|juil|aout|septembre|sept|octobre|oct|novembre|nov|decembre|dec)(?:\s+(\d{4}))?\b/))) {
    const y = m[3] ? +m[3] : today.getFullYear();
    const d = validDate(y, MONTHS[m[2]], +m[1]);
    if (d) return { date: d, iso: iso(d), source: m[0] };
  }
  if (/\bapres demain\b/.test(t.replace(/-/g, " "))) return { date: addDays(today, 2), iso: iso(addDays(today, 2)), source: "apres-demain" };
  if (/\bdemain\b/.test(t)) return { date: addDays(today, 1), iso: iso(addDays(today, 1)), source: "demain" };
  if (/\baujourd hui\b/.test(t)) return { date: today, iso: iso(today), source: "aujourd'hui" };
  if (/\bavant hier\b/.test(t.replace(/-/g, " "))) return { date: addDays(today, -2), iso: iso(addDays(today, -2)), source: "avant-hier" };
  if (/\bhier\b/.test(t)) return { date: addDays(today, -1), iso: iso(addDays(today, -1)), source: "hier" };

  // jour de semaine : "lundi", "lundi prochain", "vendredi dernier"
  if ((m = t.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(\s+(prochain|dernier|passe))?\b/))) {
    const target = WEEKDAYS[m[1]];
    const cur = today.getDay();
    const past = m[3] === "dernier" || m[3] === "passe";
    let diff = past ? -((cur - target + 7) % 7 || 7) : (target - cur + 7) % 7 || (m[3] === "prochain" ? 7 : 0);
    if (!past && diff === 0) diff = 7;
    const d = addDays(today, diff);
    return { date: d, iso: iso(d), source: m[0] };
  }
  return null;
}

module.exports = { extractPeriod, extractDate, MONTHS, iso };
