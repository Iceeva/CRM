/**
 * utils/id.js - Generation d'identifiants uniques (UUID v4)
 * Utilise le module natif `crypto` : aucune dependance externe necessaire.
 */
const { randomUUID } = require("crypto");

/** @returns {string} un UUID v4 */
function newId() {
  return randomUUID();
}

module.exports = { newId };
