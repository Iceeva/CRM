/**
 * config/prisma.js - Client Prisma (Neon PostgreSQL) + etat de connexion
 * ----------------------------------------------------------------------------
 * - Le client est un singleton paresseux : il n'est cree que si DATABASE_URL
 *   est definie, et reutilise entre les invocations d'une meme fonction
 *   serverless (globalThis).
 * - L'etat de connexion est suivi dans ce module. Le service de stockage
 *   l'interroge avant chaque operation et bascule sur le JSON si Neon est
 *   injoignable (voir services/storageService.js).
 * - Aucun setInterval en environnement serverless : le re-test de connexion est
 *   declenche "a la demande" (au plus toutes les DB_RECHECK_MS).
 */
const { env } = require("./env");

let connected = false;
let lastCheckAt = 0;
let lastError = null;
let inflight = null;

/** @returns {boolean} true si DATABASE_URL est definie */
function isConfigured() {
  return Boolean(env.DATABASE_URL);
}

/**
 * Retourne le client Prisma (cree a la premiere demande).
 * Peut lever une erreur si `prisma generate` n'a pas ete execute.
 */
function getPrisma() {
  if (!isConfigured()) {
    throw new Error("DATABASE_URL non configuree");
  }
  if (!globalThis.__crmPrisma) {
    const { PrismaClient } = require("@prisma/client");
    globalThis.__crmPrisma = new PrismaClient({
      log: env.IS_PRODUCTION ? ["error"] : ["warn", "error"],
    });
  }
  return globalThis.__crmPrisma;
}

/**
 * Teste la connexion avec `SELECT 1` et met a jour l'etat interne.
 * Les appels concurrents partagent la meme promesse.
 * @returns {Promise<boolean>}
 */
function testConnection() {
  if (!isConfigured()) {
    connected = false;
    lastError = "DATABASE_URL non configuree";
    return Promise.resolve(false);
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      connected = true;
      lastError = null;
    } catch (err) {
      connected = false;
      lastError = err.message ? err.message.split("\n").pop().slice(0, 200) : String(err);
    } finally {
      lastCheckAt = Date.now();
      inflight = null;
    }
    return connected;
  })();
  return inflight;
}

/**
 * Indique si la prochaine operation doit utiliser Neon.
 * Si la base est marquee indisponible, un nouveau test n'est tente qu'apres
 * DB_RECHECK_MS pour ne pas ralentir chaque requete.
 * @returns {Promise<boolean>}
 */
async function shouldUseDatabase() {
  if (!isConfigured()) return false;
  if (connected) return true;
  if (lastCheckAt === 0 || Date.now() - lastCheckAt >= env.DB_RECHECK_MS) {
    return testConnection();
  }
  return false;
}

/** Codes Prisma / noms d'erreurs qui indiquent un probleme de connectivite. */
const CONNECTION_CODES = new Set(["P1000", "P1001", "P1002", "P1003", "P1008", "P1017", "P2024"]);

/**
 * @param {Error & {code?: string}} err
 * @returns {boolean} true si l'erreur est liee a la connexion (et non aux donnees)
 */
function isConnectionError(err) {
  if (!err) return false;
  if (CONNECTION_CODES.has(err.code)) return true;
  const name = err.name || "";
  if (name === "PrismaClientInitializationError") return true;
  if (name === "PrismaClientRustPanicError") return true;
  return /Can't reach database|Connection terminated|ECONNREFUSED|ENOTFOUND|did not initialize yet/i.test(
    err.message || ""
  );
}

/** Marque la base comme indisponible (appele apres une erreur de connexion). */
function markDown(err) {
  connected = false;
  lastCheckAt = Date.now();
  lastError = err && err.message ? err.message.split("\n").pop().slice(0, 200) : "erreur inconnue";
  console.warn("[db] Neon indisponible, bascule JSON :", lastError);
}

/** Demarre un test periodique (usage local uniquement, pas en serverless). */
function startHealthCheck(intervalMs = 30000) {
  if (!isConfigured() || env.IS_VERCEL) return null;
  const timer = setInterval(async () => {
    const before = connected;
    await testConnection();
    if (!before && connected) console.log("[db] Neon retabli : bascule automatique vers PostgreSQL");
    if (before && !connected) console.warn("[db] Neon injoignable : bascule vers le JSON");
  }, intervalMs);
  if (timer.unref) timer.unref();
  return timer;
}

/** Ferme proprement le client (arret du serveur, scripts). */
async function disconnect() {
  if (globalThis.__crmPrisma) {
    await globalThis.__crmPrisma.$disconnect();
    globalThis.__crmPrisma = null;
  }
  connected = false;
}

/** Etat expose par /api/health et /api/dashboard/status. */
function status() {
  return {
    configured: isConfigured(),
    connected,
    provider: isConfigured() ? "neon-postgresql" : null,
    lastCheckAt: lastCheckAt ? new Date(lastCheckAt).toISOString() : null,
    lastError,
  };
}

module.exports = {
  getPrisma,
  isConfigured,
  testConnection,
  shouldUseDatabase,
  isConnectionError,
  markDown,
  startHealthCheck,
  disconnect,
  status,
  isConnected: () => connected,
};
