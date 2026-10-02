#!/usr/bin/env node
/**
 * prisma/seed.js - Remplit la base Neon avec les donnees de demonstration
 * ----------------------------------------------------------------------------
 * Source : backend/data/data.json (la meme que le mode JSON de secours).
 * Idempotent : utilise des "upsert" sur l'id, donc relancable sans doublons.
 *
 * Usage :
 *   npm run db:seed                  (depuis la racine)
 *   node backend/prisma/seed.js --reset   (vide d'abord les tables)
 */
const fs = require("fs");
const path = require("path");
const { env } = require("../src/config/env");
const { getPrisma, isConfigured, disconnect } = require("../src/config/prisma");
const { meta } = require("../src/stores/schema");
const { toStorage } = require("../src/stores/normalize");

// Ordre important : les tables parentes avant les tables enfants (cles etrangeres)
const ORDER = ["users", "clients", "prospects", "interactions", "opportunities"];

async function seed({ reset = false, silent = false } = {}) {
  const log = (...a) => !silent && console.log(...a);

  if (!isConfigured()) {
    throw new Error("DATABASE_URL non definie : impossible de remplir Neon. Renseignez backend/.env");
  }
  const prisma = getPrisma();
  const source = JSON.parse(fs.readFileSync(env.JSON_SEED_PATH, "utf-8"));

  if (reset) {
    log("[seed] Suppression des donnees existantes...");
    await prisma.chatMessage.deleteMany();
    await prisma.interaction.deleteMany();
    await prisma.opportunity.deleteMany();
    await prisma.prospect.deleteMany();
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();
  }

  const summary = {};
  for (const collection of ORDER) {
    const delegate = prisma[meta(collection).model];
    let ok = 0;
    for (const row of source[collection] || []) {
      const data = toStorage(collection, row, { target: "prisma", creating: true });
      try {
        await delegate.upsert({ where: { id: row.id }, update: data, create: data });
        ok++;
      } catch (err) {
        // Conflit d'unicite (ex: admin deja cree avec un autre id) : on ignore
        if (err.code !== "P2002") throw err;
      }
    }
    summary[collection] = ok;
    log(`[seed] ${collection.padEnd(13)} ${ok} enregistrement(s)`);
  }
  return summary;
}

module.exports = { seed };

if (require.main === module) {
  const reset = process.argv.includes("--reset");
  seed({ reset })
    .then(() => {
      console.log("\n[seed] Termine. Compte de demo : admin@crm.com / admin123");
    })
    .catch((err) => {
      console.error("[seed] Echec :", err.message);
      process.exitCode = 1;
    })
    .finally(() => disconnect());
}
