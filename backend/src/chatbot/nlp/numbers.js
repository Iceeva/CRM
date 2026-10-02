/**
 * chatbot/nlp/numbers.js - Extraction de montants et de nombres
 * ----------------------------------------------------------------------------
 * Comprend :
 *   15000   15 000   15.000   15 000,50   1,5 k   15k   2 M   2,5 millions
 *   15000 euros   15000 EUR   15000 €   15 k€   "mille", "dix mille" (mots simples)
 *   "entre 1000 et 5000", "plus de 10k", "moins de 500", "au moins 2000", "au plus 800"
 */
const { stripAccents } = require("./normalize");

const WORD_NUMBERS = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20,
  trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, mille: 1000,
};

/** Convertit "15 000,50" / "15.000" / "1,5" en nombre. */
function parseNumber(str) {
  let s = String(str).replace(/\s|\u00A0|\u202F/g, "");
  // 15.000 ou 1.234.567 : points separateurs de milliers
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  // 15,000 anglais (virgule + 3 chiffres + pas d'autre virgule) : ambigu, on suppose milliers si > 3 chiffres avant ?
  s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const MULTIPLIERS = [
  [/^(k|mille)$/, 1e3],
  [/^(m|millions?|mio)$/, 1e6],
  [/^(md|milliards?|bn)$/, 1e9],
];

function multiplier(unit) {
  if (!unit) return 1;
  for (const [re, v] of MULTIPLIERS) if (re.test(unit)) return v;
  return 1;
}

/**
 * Extrait tous les montants du texte.
 * @returns {{ value: number, source: string, hasCurrency: boolean }[]}
 */
function extractAmounts(text) {
  const t = stripAccents(String(text).toLowerCase());
  const out = [];
  // nombre (avec separateurs) + unite optionnelle (k, m, millions) + devise optionnelle
  const re = /(\d{1,3}(?:[ \u00A0\u202F.]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(k|mille|millions?|mio|m|milliards?|md)?\s*(euros?|eur|e|€|fcfa|xof|cfa|usd|dollars?|\$)?(?![a-z0-9])/g;
  let m;
  while ((m = re.exec(t))) {
    const raw = m[1];
    const unit = m[2];
    const cur = m[3];
    // Les dates (12/10/2026) et telephones ne doivent pas etre pris pour des montants
    const before = t[m.index - 1];
    const after = t[m.index + m[0].length];
    if (before === "/" || after === "/" || before === "+" || before === "@") continue;
    if (/^\d{1,2}$/.test(raw) && !unit && !cur) continue; // petits entiers isoles : pas des montants
    if (/^\d{9,}$/.test(raw.replace(/\D/g, "")) && !cur && !unit) continue; // telephone
    const base = parseNumber(raw);
    if (base === null) continue;
    // "e" seul = euro uniquement s'il suit un nombre et que la devise est reconnue
    const value = base * multiplier(unit);
    if (!unit && !cur && base < 100) continue;
    out.push({ value, source: m[0].trim(), hasCurrency: Boolean(cur) });
  }
  return out;
}

/**
 * Contrainte de montant : "plus de 10k", "moins de 500", "entre 1000 et 5000".
 * @returns {{ min?: number, max?: number } | null}
 */
function extractAmountConstraint(text) {
  const t = stripAccents(String(text).toLowerCase());
  const amounts = extractAmounts(t);
  if (!amounts.length) return null;

  const between = t.match(/entre\s+.+?\s+et\s+/);
  if (between && amounts.length >= 2) {
    const [a, b] = [amounts[0].value, amounts[1].value].sort((x, y) => x - y);
    return { min: a, max: b };
  }
  if (/\b(plus de|superieur(?:e)? a|depasse|au moins|minimum|>=?|a partir de|au dessus de|supérieur)\b/.test(t)) {
    return { min: amounts[0].value };
  }
  if (/\b(moins de|inferieur(?:e)? a|au plus|maximum|<=?|jusqu a|en dessous de|sous les)\b/.test(t)) {
    return { max: amounts[0].value };
  }
  return null;
}

/** Entier simple ("les 5 derniers", "top 3", "trois clients"). */
function extractCount(text) {
  const t = stripAccents(String(text).toLowerCase());
  let m = t.match(/\b(?:top|les|derniers?|dernieres?|premiers?|premieres?)\s+(\d{1,3})\b/);
  if (m) return parseInt(m[1], 10);
  m = t.match(/\b(\d{1,3})\s+(?:derniers?|dernieres?|premiers?|premieres?|clients?|prospects?|opportunites?|interactions?|resultats?|lignes?)\b/);
  if (m) return parseInt(m[1], 10);
  for (const [w, v] of Object.entries(WORD_NUMBERS)) {
    if (v >= 2 && v <= 20 && new RegExp(`\\b${w}\\s+(derniers?|dernieres?|premiers?|premieres?|clients?|prospects?|opportunites?|interactions?)\\b`).test(t)) return v;
  }
  return null;
}

module.exports = { extractAmounts, extractAmountConstraint, extractCount, parseNumber };
