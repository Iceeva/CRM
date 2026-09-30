#!/usr/bin/env node
/**
 * init-data.js — Hash les mots de passe des utilisateurs de démo dans data.json
 * Usage : cd backend && npm install && node init-data.js
 */
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "data/data.json");

async function init() {
  console.log("🔧  Initialisation des données de démo...\n");

  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

  // Hash du mot de passe admin
  const adminHash = await bcrypt.hash("admin123", 10);

  // Mettre à jour ou créer l'admin
  const adminIdx = data.users.findIndex((u) => u.email === "admin@crm.com");
  if (adminIdx >= 0) {
    data.users[adminIdx].password = adminHash;
  } else {
    data.users.push({
      id: "admin-001",
      nom: "Administrateur",
      email: "admin@crm.com",
      password: adminHash,
      role: "admin",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");

  console.log("✅  Mot de passe admin hashé avec succès !\n");
  console.log("📋  Compte de démo :");
  console.log("   Email    : admin@crm.com");
  console.log("   Password : admin123\n");
}

init().catch(console.error);
