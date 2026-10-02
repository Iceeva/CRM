#!/usr/bin/env node
/**
 * scripts/initDb.js - Initialise la base Neon : migrations + donnees de demo
 * ----------------------------------------------------------------------------
 * 1. applique les migrations Prisma (`prisma migrate deploy`)
 * 2. insere les donnees de demonstration (seed idempotent)
 *
 * Usage : npm run init-db   (depuis backend/)  ou  node backend/src/scripts/initDb.js
 */
const path = require("path");
const { spawnSync } = require("child_process");
const { isConfigured, testConnection, disconnect } = require("../config/prisma");
const { seed } = require("../../prisma/seed");

async function run() {
  if (!isConfigured()) {
    console.error("DATABASE_URL non definie. Copiez backend/.env.example en backend/.env et renseignez vos URLs Neon.");
    process.exit(1);
  }

  console.log("[init] Application des migrations Prisma...");
  const schema = path.join(__dirname, "../../prisma/schema.prisma");
  const res = spawnSync("npx", ["prisma", "migrate", "deploy", "--schema", schema], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    console.error("[init] Echec des migrations. Verifiez DIRECT_URL (URL non poolee) dans backend/.env");
    process.exit(res.status || 1);
  }

  if (!(await testConnection())) {
    console.error("[init] Connexion impossible apres migration.");
    process.exit(1);
  }

  console.log("[init] Insertion des donnees de demonstration...");
  await seed();
  console.log("\n[init] Base initialisee. Compte de demo : admin@crm.com / admin123");
}

run()
  .catch((err) => {
    console.error("[init] Erreur :", err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
