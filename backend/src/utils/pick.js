/**
 * utils/pick.js - Selection de champs et nettoyage des valeurs
 */

/** Ne conserve que les cles autorisees presentes (non undefined) dans `source`. */
function pick(source, keys) {
  const out = {};
  for (const k of keys) {
    if (source && source[k] !== undefined) out[k] = source[k];
  }
  return out;
}

/** Transforme une chaine vide en null (utile pour les cles etrangeres). */
function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

module.exports = { pick, emptyToNull };
