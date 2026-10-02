/**
 * chatbot/nlp/stemmer.js - Racinisation legere du francais
 * ----------------------------------------------------------------------------
 * Reduit un mot a sa "racine" approximative pour que "client", "clients",
 * "cliente" ou "ajouter", "ajoutez", "ajoute" soient reconnus comme identiques.
 *
 * Ce n'est pas un stemmer linguistiquement parfait (Snowball) mais une version
 * compacte et deterministe, suffisante pour un vocabulaire metier restreint.
 * L'essentiel est la COHERENCE : le meme stemmer est applique au catalogue et
 * aux phrases utilisateur.
 *
 * Entree : mot en minuscules SANS accents.
 */

// Suffixes tries du plus long au plus court. Un suffixe n'est retire que si la
// racine restante garde au moins MIN_STEM caracteres.
const SUFFIXES = [
  "issements", "issement", "atrices", "atrice", "ateurs", "ateur", "ations", "ation",
  "usement", "ements", "ement", "ements", "ences", "ence", "ances", "ance", "iques", "ique",
  "ables", "able", "ibles", "ible", "istes", "iste", "euses", "euse", "ments", "ment",
  "erions", "eriez", "eront", "erons", "erez", "erait", "eraient", "eras", "erai",
  "assent", "aient", "asses", "antes", "ante", "ants", "ant",
  "ions", "iez", "ons", "ez", "ees", "ee", "es", "er", "ir", "ait", "ent", "eur", "eux", "ite", "ites", "ive", "ives", "if", "ifs",
];

const MIN_STEM = 3;

/** Cas irreguliers frequents dans le domaine. */
const IRREGULAR = {
  aux: "al",
  yeux: "oeil",
  gens: "gen",
  fais: "fai",
  fait: "fai",
  faire: "fai",
  vais: "va",
  vas: "va",
  vont: "va",
  est: "est",
  sont: "sont",
  suis: "sui",
  ete: "ete",
  ai: "ai",
  as: "as",
  a: "a",
  nouveau: "nouv",
  nouveaux: "nouv",
  nouvelle: "nouv",
  nouvelles: "nouv",
  beau: "beau",
  gros: "gro",
  grosse: "gro",
  grosses: "gro",
  grand: "grand",
  grande: "grand",
  grands: "grand",
  grandes: "grand",
};

/**
 * @param {string} word mot normalise (minuscules, sans accents)
 * @returns {string} racine
 */
function stem(word) {
  if (!word) return word;
  // Tokens contenant des chiffres, @ . : / % : ce ne sont pas des mots
  if (/[0-9@.:/%+_]/.test(word)) return word;
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.length <= 3) return word;

  let w = word;

  // 1. Pluriel (-s, -x) sauf mots en -ss, -us, -is courts
  if (/[sx]$/.test(w) && !/(ss|us)$/.test(w) && w.length > 3) {
    w = w.slice(0, -1);
  }
  if (IRREGULAR[w]) return IRREGULAR[w];

  // 2. Suffixe derivationnel / verbal le plus long possible
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= MIN_STEM) {
      w = w.slice(0, -suf.length);
      break;
    }
  }

  // 3. Voyelle finale muette (-e) et doublon de consonne finale
  if (w.length > MIN_STEM && /e$/.test(w)) w = w.slice(0, -1);
  if (w.length > MIN_STEM && /(.)\1$/.test(w) && !/(ss|ll)$/.test(w)) w = w.slice(0, -1);

  return w;
}

/** Racinise une liste de mots. */
function stemAll(words) {
  return words.map(stem);
}

module.exports = { stem, stemAll };
