/**
 * controllers/authController.js — Inscription, connexion, profil
 */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const storage = require("../services/storageService");

const SECRET = process.env.JWT_SECRET || "crm_super_secret_key_2024";
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: EXPIRES });
}

/**
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { nom, email, password, role } = req.body;

    if (!nom || !email || !password) {
      return res.status(400).json({ error: "nom, email et password sont requis" });
    }

    // Vérifier doublon
    const existing = await storage.findAll("users", { filters: { email }, limit: 1 });
    if (existing.data.length > 0) {
      return res.status(409).json({ error: "Un compte avec cet email existe déjà" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await storage.create("users", {
      id: uuidv4(),
      nom,
      email,
      password: hashed,
      role: role || "user",
    });

    const { password: _, ...safe } = user;
    const token = generateToken(user);

    res.status(201).json({ token, user: safe });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email et password requis" });
    }

    const result = await storage.findAll("users", { filters: { email }, limit: 1 });
    const user = result.data[0];

    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const { password: _, ...safe } = user;
    const token = generateToken(user);

    res.json({ token, user: safe });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    const user = await storage.findById("users", req.userId);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};
