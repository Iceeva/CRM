#!/usr/bin/env node
/**
 * scripts/prisma-generate.js - `prisma generate` tolerant (postinstall)
 * ----------------------------------------------------------------------------
 * Genere le client Prisma apres `npm install`, ce qui est indispensable sur
 * Vercel. L'echec ne bloque jamais l'installation : sans client genere,
 * l'application bascule simplement en mode JSON.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const schema = path.join(__dirname, "../backend/prisma/schema.prisma");
const result = spawnSync("npx", ["--no-install", "prisma", "generate", "--schema", schema], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    // `prisma generate` n'ouvre aucune connexion, mais valide la presence des variables
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder",
    DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});

if (result.status !== 0) {
  console.warn("\n[prisma] generate a echoue ou prisma est absent : mode JSON uniquement tant que le client n'est pas genere.");
}
process.exit(0);
