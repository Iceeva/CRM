/**
 * config/db.js — Connexion PostgreSQL
 * Tente de se connecter au démarrage.
 * Exporte le pool + un flag `isConnected`.
 */
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "crm_db",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let isConnected = false;

/**
 * Tente une connexion test ; met à jour `isConnected`.
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    client.release();
    isConnected = true;
    console.log("✅  PostgreSQL connecté");
    return true;
  } catch (err) {
    isConnected = false;
    console.warn("⚠️  PostgreSQL indisponible :", err.message);
    return false;
  }
}

/**
 * Vérifie périodiquement si PostgreSQL redevient disponible (toutes les 30 s).
 */
function startHealthCheck(interval = 30000) {
  setInterval(async () => {
    const wasBefore = isConnected;
    await testConnection();
    if (!wasBefore && isConnected) {
      console.log("🔄  PostgreSQL rétabli — bascule automatique");
    }
  }, interval);
}

module.exports = {
  pool,
  testConnection,
  startHealthCheck,
  get isConnected() {
    return isConnected;
  },
};
