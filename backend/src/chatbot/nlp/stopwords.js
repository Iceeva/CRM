/**
 * chatbot/nlp/stopwords.js - Mots vides francais
 * ----------------------------------------------------------------------------
 * Les mots vides n'apportent aucune information d'intention. Ils sont retires
 * du calcul de similarite mais conserves pour la detection d'expressions.
 *
 * Volontairement CONSERVES (donc absents de la liste) :
 *   - negations : ne, pas, non, jamais, sans, aucun
 *   - mots interrogatifs : combien, comment, quel, quand, ou, qui, pourquoi
 *   - marqueurs de quantite : tous, toutes, plus, moins, derniers
 * Les mots sont sans accent (le texte est normalise avant).
 */
const STOPWORDS = new Set(
  (
    "le la les un une des du de d l au aux a en dans sur sous par pour avec chez vers " +
    "et ou mais donc or ni car que qu quoi dont ce cet cette ces c se s sa son ses " +
    "mon ma mes ton ta tes notre nos votre vos leur leurs je j tu il elle on nous vous ils elles " +
    "me m te t moi toi lui y est es sont suis etes ete etre ai as avons avez ont avoir " +
    "fait faire fais faut peux peut pouvez peuvent veux veut voudrais voudrait aimerais " +
    "aller va vas vont allez ca cela ceci celui celle ceux " +
    "tres bien alors aussi encore deja tout toute " +
    "s il vous plait svp stp merci " +
    "mes mon ma ta tes ici la voila voici " +
    "moi meme"
  ).split(/\s+/)
);

/** Marqueurs de negation (utiles pour inverser un sens, ex: "ne pas supprimer"). */
const NEGATIONS = new Set(["ne", "pas", "non", "jamais", "sans", "aucun", "aucune", "nul", "ni", "plus"]);

/** Mots interrogatifs. */
const QUESTION_WORDS = new Set(["combien", "comment", "quel", "quelle", "quels", "quelles", "quand", "ou", "qui", "pourquoi", "quoi", "est ce que"]);

function isStopword(token) {
  return STOPWORDS.has(token);
}

module.exports = { STOPWORDS, NEGATIONS, QUESTION_WORDS, isStopword };
