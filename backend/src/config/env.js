/**
 * config/env.js - Configuration centralisee de l'application
 * ----------------------------------------------------------------------------
 * Toutes les variables d'environnement sont lues ICI et nulle part ailleurs.
 * Les autres modules importent cet objet : cela evite les process.env eparpilles
 * et permet de valider la configuration au demarrage.
 *
 * Voir backend/.env.example pour la liste complete et documentee.
 */
const path = require("path");

// Charge backend/.env en local. Sur Vercel les variables sont injectees par la
// plateforme, donc l'absence de fichier .env n'est pas une erreur.
try {
  require("dotenv").config({ path: path.join(__dirname, "../../.env") });
} catch (_) {
  /* dotenv facultatif en production */
}

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "oui"].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const float = (value, fallback) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_VERCEL = Boolean(process.env.VERCEL);
const IS_PRODUCTION = NODE_ENV === "production" || IS_VERCEL;

const DEV_JWT_SECRET = "dev-only-secret-change-me";

const env = {
  NODE_ENV,
  IS_VERCEL,
  IS_PRODUCTION,
  PORT: int(process.env.PORT, 5000),

  // ---- Base de donnees (Neon PostgreSQL via Prisma) ----
  DATABASE_URL: process.env.DATABASE_URL || "",
  DIRECT_URL: process.env.DIRECT_URL || "",
  // Intervalle minimal entre deux tests de connexion (ms)
  DB_RECHECK_MS: int(process.env.DB_RECHECK_MS, 15000),

  // ---- Authentification ----
  JWT_SECRET: process.env.JWT_SECRET || DEV_JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  BCRYPT_ROUNDS: int(process.env.BCRYPT_ROUNDS, 10),

  // ---- CORS ----
  // Liste separee par des virgules. Vide = meme origine uniquement en production,
  // toutes origines en developpement.
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // ---- Mode de secours JSON ----
  // Sur Vercel le disque est en lecture seule sauf /tmp (non persistant).
  JSON_STORE_PATH:
    process.env.JSON_STORE_PATH ||
    (IS_VERCEL
      ? "/tmp/crm-data.json"
      : path.join(__dirname, "../../data/data.json")),
  JSON_SEED_PATH: path.join(__dirname, "../../data/data.json"),

  // ---- Chatbot ----
  CHATBOT_ENABLED: bool(process.env.CHATBOT_ENABLED, true),
  CHATBOT_DEBUG: bool(process.env.CHATBOT_DEBUG, !IS_PRODUCTION),
  CHATBOT_PERSIST_HISTORY: bool(process.env.CHATBOT_PERSIST_HISTORY, true),
  CHATBOT_MIN_CONFIDENCE: float(process.env.CHATBOT_MIN_CONFIDENCE, 0.55),
  CHATBOT_AMBIGUITY_MARGIN: float(process.env.CHATBOT_AMBIGUITY_MARGIN, 0.12),

  // ---- IA optionnelle (OpenAI / Anthropic) ----
  // AI_PROVIDER : none | openai | anthropic | auto
  AI_PROVIDER: (process.env.AI_PROVIDER || "none").toLowerCase(),
  // AI_MODE : off | fallback | assist
  AI_MODE: (process.env.AI_MODE || "fallback").toLowerCase(),
  AI_FAILOVER: bool(process.env.AI_FAILOVER, true),
  AI_TIMEOUT_MS: int(process.env.AI_TIMEOUT_MS, 15000),
  AI_MAX_TOKENS: int(process.env.AI_MAX_TOKENS, 600),
  AI_TEMPERATURE: float(process.env.AI_TEMPERATURE, 0.3),
  AI_SHARE_CRM_DATA: bool(process.env.AI_SHARE_CRM_DATA, false),

  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini",
  OPENAI_BASE_URL: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  ANTHROPIC_BASE_URL: (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, ""),
  ANTHROPIC_VERSION: process.env.ANTHROPIC_VERSION || "2023-06-01",
};

/**
 * Valide la configuration. Retourne une liste d'avertissements (jamais bloquant
 * sauf secret JWT manquant en production).
 */
function validateEnv() {
  const warnings = [];

  if (env.IS_PRODUCTION && env.JWT_SECRET === DEV_JWT_SECRET) {
    throw new Error(
      "JWT_SECRET est obligatoire en production. Generez-en un avec : node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }
  if (!env.IS_PRODUCTION && env.JWT_SECRET === DEV_JWT_SECRET) {
    warnings.push("JWT_SECRET non defini : secret de developpement utilise.");
  }
  if (!env.DATABASE_URL) {
    warnings.push("DATABASE_URL absente : mode de secours JSON active (pas de Neon).");
  } else if (env.IS_PRODUCTION && !/pooler/.test(env.DATABASE_URL)) {
    warnings.push("DATABASE_URL ne semble pas utiliser l'hote poolee Neon (-pooler) : risque de saturation des connexions en serverless.");
  }
  if (env.IS_VERCEL && !env.DATABASE_URL) {
    warnings.push("Sur Vercel, le mode JSON est ephemere (/tmp) : configurez DATABASE_URL pour persister les donnees.");
  }
  if (env.AI_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
    warnings.push("AI_PROVIDER=openai mais OPENAI_API_KEY est vide : moteur local utilise.");
  }
  if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
    warnings.push("AI_PROVIDER=anthropic mais ANTHROPIC_API_KEY est vide : moteur local utilise.");
  }
  return warnings;
}

module.exports = { env, validateEnv };
