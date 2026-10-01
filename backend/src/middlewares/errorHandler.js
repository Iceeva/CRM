/**
 * middlewares/errorHandler.js - 404 API et gestion d'erreurs globale
 * ----------------------------------------------------------------------------
 * Traduit les erreurs techniques en reponses HTTP propres :
 *  - HttpError                  -> son propre status
 *  - Prisma P2002 / JSON unique -> 409 (doublon)
 *  - Prisma P2003 / JSON FK     -> 400 (reference invalide)
 *  - Prisma P2025               -> 404 (introuvable)
 *  - JSON mal forme dans le body-> 400
 *  - le reste                   -> 500 (message masque en production)
 */
const { env } = require("../config/env");

function notFound(req, res) {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || "Erreur interne du serveur";

  if (err.code === "P2002") {
    status = 409;
    message = "Cette valeur existe deja";
  } else if (err.code === "P2003") {
    status = 400;
    message = err.message.startsWith("Reference") ? err.message : "Reference invalide (enregistrement lie inexistant)";
  } else if (err.code === "P2025") {
    status = 404;
    message = "Enregistrement introuvable";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Corps de requete JSON invalide";
  } else if (err.type === "entity.too.large") {
    status = 413;
    message = "Corps de requete trop volumineux";
  }

  if (status >= 500) {
    console.error(`[erreur] ${req.id || "-"} ${req.method} ${req.originalUrl} :`, err);
    if (env.IS_PRODUCTION) message = "Erreur interne du serveur";
  }

  const body = { error: message };
  if (err.errors) body.errors = err.errors;
  if (req.id) body.requestId = req.id;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
