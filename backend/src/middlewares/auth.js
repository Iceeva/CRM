/**
 * middlewares/auth.js — Vérification JWT
 */
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "crm_super_secret_key_2024";

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant ou invalide" });
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token expiré ou invalide" });
  }
}

module.exports = authMiddleware;
