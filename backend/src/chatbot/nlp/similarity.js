/**
 * chatbot/nlp/similarity.js - Mesures de similarite entre chaines
 * ----------------------------------------------------------------------------
 * Sert a tolerer les fautes de frappe : "cleints" ~ "clients", "prospet" ~ "prospect".
 *
 *  - damerauLevenshtein : distance d'edition avec transposition ("cleint" -> "client" = 1)
 *  - similarity         : score 0..1 base sur la distance, normalise par la longueur
 *  - jaroWinkler        : score 0..1 favorisant les prefixes communs (noms propres)
 *  - fuzzyTokenScore    : score de correspondance d'un mot a un autre, avec seuils
 *                         adaptes a la longueur (un mot de 3 lettres n'a pas de tolerance)
 */

/**
 * Distance de Damerau-Levenshtein (version "optimal string alignment").
 * @returns {number} nombre minimal d'insertions, suppressions, substitutions, transpositions
 */
function damerauLevenshtein(a, b, maxDistance = Infinity) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDistance) return maxDistance + 1;
  if (!la) return lb;
  if (!lb) return la;

  const d = [];
  for (let i = 0; i <= la; i++) {
    d[i] = new Array(lb + 1);
    d[i][0] = i;
  }
  for (let j = 0; j <= lb; j++) d[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return d[la][lb];
}

/** Similarite normalisee 0..1 (1 = identiques). */
function similarity(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const dist = damerauLevenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

/** Jaro-Winkler 0..1 : tres adapte aux noms propres. */
function jaroWinkler(s1, s2, prefixScale = 0.1) {
  if (s1 === s2) return 1;
  const l1 = s1.length;
  const l2 = s2.length;
  if (!l1 || !l2) return 0;

  const range = Math.max(0, Math.floor(Math.max(l1, l2) / 2) - 1);
  const m1 = new Array(l1).fill(false);
  const m2 = new Array(l2).fill(false);
  let matches = 0;

  for (let i = 0; i < l1; i++) {
    const start = Math.max(0, i - range);
    const end = Math.min(i + range + 1, l2);
    for (let j = start; j < end; j++) {
      if (!m2[j] && s1[i] === s2[j]) {
        m1[i] = m2[j] = true;
        matches++;
        break;
      }
    }
  }
  if (!matches) return 0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < l1; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }
  const jaro = (matches / l1 + matches / l2 + (matches - t / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, l1, l2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * prefixScale * (1 - jaro);
}

/** Nombre d'erreurs tolerees selon la longueur du mot. */
function allowedEdits(length) {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
}

/**
 * Score de correspondance entre un mot saisi et un mot attendu.
 *  1.0  identiques
 *  0.92 un prefixe de l'autre (>= 4 lettres) : "prospec" ~ "prospect"
 *  0.5..0.9 faute de frappe dans la tolerance de longueur
 *  0    sinon
 */
function fuzzyTokenScore(input, target, { prefix = true } = {}) {
  if (input === target) return 1;
  const min = Math.min(input.length, target.length);
  if (prefix && min >= 4 && (target.startsWith(input) || input.startsWith(target))) return 0.92;

  // Tolerance calculee sur le mot le plus COURT : "prospect" ne doit pas valoir "prospection"
  const tol = allowedEdits(min);
  if (tol === 0) return 0;
  const dist = damerauLevenshtein(input, target, tol);
  if (dist > tol) return 0;
  // 1 erreur = 0.85, 2 = 0.72, 3 = 0.6 (decroissance douce)
  return Math.max(0.5, 0.97 - dist * 0.12 - (dist / Math.max(input.length, target.length)) * 0.3);
}

module.exports = { damerauLevenshtein, similarity, jaroWinkler, allowedEdits, fuzzyTokenScore };
