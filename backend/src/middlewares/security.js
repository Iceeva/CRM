/**
 * middlewares/security.js - En-tetes de securite, identifiant de requete
 * ----------------------------------------------------------------------------
 * Equivalent leger de `helmet`, sans dependance supplementaire.
 */
const { randomUUID } = require("crypto");
const { env } = require("../config/env");

/** En-tetes HTTP de securite appliques a toutes les reponses. */
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (env.IS_PRODUCTION) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
}

/** Attribue un identifiant a chaque requete (utile pour les logs et le support). */
function requestId(req, res, next) {
  req.id = req.headers["x-request-id"] || req.headers["x-vercel-id"] || randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

module.exports = { securityHeaders, requestId };
