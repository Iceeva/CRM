/**
 * chatbot/nlp/tokenizer.js - Tokens, racines et n-grammes
 */
const { normalize } = require("./normalize");
const { stem } = require("./stemmer");
const { isStopword } = require("./stopwords");

/** Genere les n-grammes (suites de n elements consecutifs). */
function ngrams(items, n) {
  const out = [];
  for (let i = 0; i + n <= items.length; i++) out.push(items.slice(i, i + n).join(" "));
  return out;
}

/**
 * Analyse complete d'une phrase.
 * @param {string} text texte brut
 * @returns {{
 *   raw: string, clean: string, tokens: string[], stems: string[],
 *   content: string[], contentStems: string[], bigrams: string[], trigrams: string[]
 * }}
 *  - tokens        : tous les mots normalises
 *  - stems         : racines de tous les mots (alignees sur tokens)
 *  - content       : mots non vides
 *  - contentStems  : racines des mots non vides
 *  - bigrams/trigrams : sur les racines de TOUS les mots (pour les expressions)
 */
function analyze(text) {
  const { raw, clean, tokens } = normalize(text);
  const stems = tokens.map(stem);
  const content = [];
  const contentStems = [];
  tokens.forEach((t, i) => {
    if (!isStopword(t)) {
      content.push(t);
      contentStems.push(stems[i]);
    }
  });
  return {
    raw,
    clean,
    tokens,
    stems,
    content,
    contentStems,
    bigrams: ngrams(stems, 2),
    trigrams: ngrams(stems, 3),
  };
}

module.exports = { analyze, ngrams };
