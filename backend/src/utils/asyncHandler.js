/**
 * utils/asyncHandler.js - Enveloppe un handler async pour transmettre
 * automatiquement les erreurs au middleware d'erreur global (Express 4).
 */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
