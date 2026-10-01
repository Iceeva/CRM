/**
 * controllers/authController.js - Inscription, connexion, profil
 */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const storage = require("../services/storageService");
const { env } = require("../config/env");
const { newId } = require("../utils/id");
const { HttpError } = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

/** Retire le hash du mot de passe avant d'envoyer l'utilisateur au client. */
function sanitize(user) {
  const { password, ...safe } = user;
  return safe;
}

async function findByEmail(email) {
  const result = await storage.findAll("users", { filters: { email }, limit: 1 });
  return result.data[0] || null;
}

/**
 * POST /api/auth/register
 * Le role est TOUJOURS "user" : un champ `role` envoye par le client est ignore
 * (empeche l'auto-attribution du role admin).
 */
exports.register = asyncHandler(async (req, res) => {
  const { nom, password } = req.body;
  const email = req.body.email.toLowerCase();

  if (await findByEmail(email)) {
    throw new HttpError(409, "Un compte avec cet email existe deja");
  }

  const hashed = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const user = await storage.create("users", {
    id: newId(),
    nom,
    email,
    password: hashed,
    role: "user",
  });

  res.status(201).json({ token: generateToken(user), user: sanitize(user) });
});

/** POST /api/auth/login */
exports.login = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const email = req.body.email.toLowerCase();

  const user = await findByEmail(email);
  // Meme message que le mot de passe soit faux ou le compte inconnu (pas de fuite d'information)
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new HttpError(401, "Email ou mot de passe incorrect");
  }

  res.json({ token: generateToken(user), user: sanitize(user) });
});

/** GET /api/auth/me */
exports.getMe = asyncHandler(async (req, res) => {
  const user = await storage.findById("users", req.userId);
  if (!user) throw new HttpError(404, "Utilisateur introuvable");
  res.json(sanitize(user));
});
