/**
 * server.js - Demarrage local du serveur CRM
 * ----------------------------------------------------------------------------
 * 1. valide la configuration
 * 2. teste la connexion Neon (sinon mode JSON)
 * 3. demarre Express et gere l'arret propre (SIGINT / SIGTERM)
 *
 * Sur Vercel ce fichier n'est PAS utilise : voir api/index.js.
 */
const { env, validateEnv } = require("./config/env");
const db = require("./config/prisma");
const app = require("./app");

async function start() {
  console.log("----------------------------------------------------");
  console.log("  CRM Pro - demarrage du serveur");
  console.log("----------------------------------------------------");

  validateEnv().forEach((w) => console.warn("[config]", w));

  const dbOk = await db.testConnection();
  if (dbOk) {
    console.log("[stockage] Neon PostgreSQL (Prisma) connecte");
  } else if (db.isConfigured()) {
    console.warn("[stockage] Neon injoignable, mode JSON de secours :", db.status().lastError);
  } else {
    console.log("[stockage] Mode JSON (DATABASE_URL non definie)");
    console.log("           donnees lues/ecrites dans", env.JSON_STORE_PATH);
  }
  db.startHealthCheck(30000);

  const server = app.listen(env.PORT, () => {
    console.log(`[http] API disponible sur http://localhost:${env.PORT}/api`);
    console.log("----------------------------------------------------\n");
  });

  const shutdown = async (signal) => {
    console.log(`\n[arret] ${signal} recu, fermeture...`);
    server.close(async () => {
      await db.disconnect().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((err) => {
  console.error("Echec du demarrage :", err);
  process.exit(1);
});
