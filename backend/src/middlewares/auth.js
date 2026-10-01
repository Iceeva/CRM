/**
 * middlewares/auth.js - Verification du jeton JWT et des roles
 * ----------------------------------------------------------------------------
 * Le jeton est attendu dans l'en-tete  Authorization: Bearer <token>.
 * Apres verification, req.userId et req.userRole sont disponibles.
 */
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant ou invalide" });
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token expire ou invalide" });
  }
}

/**
 * Restreint une route a certains roles.
 * Usage : router.delete("/:id", auth, requireRole("admin"), ctrl.remove)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: "Acces refuse : droits insuffisants" });
    }
    next();
  };
}

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
