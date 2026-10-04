#!/usr/bin/env node
/**
 * init-data.js - Regenere le hash du mot de passe admin dans data.json (mode JSON)
 * Usage : cd backend && npm install && node init-data.js
 *
 * Utile uniquement si vous voulez changer le mot de passe de demo du mode JSON.
 * Variable optionnelle : ADMIN_PASSWORD (defaut : admin123).
 */
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "data/data.json");
const PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

async function init() {
  console.log("[init-data] Initialisation du compte administrateur...\n");

  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date().toISOString();

  const idx = data.users.findIndex((u) => u.email === "admin@crm.com");
  if (idx >= 0) {
    data.users[idx].password = hash;
    data.users[idx].updated_at = now;
  } else {
    data.users.push({
      id: "admin-001",
      nom: "Administrateur",
      email: "admin@crm.com",
      password: hash,
      role: "admin",
      created_at: now,
      updated_at: now,
    });
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log("[init-data] Mot de passe admin hashe avec succes.");
  console.log("            Email    : admin@crm.com");
  console.log(`            Password : ${PASSWORD}\n`);
}

init().catch(console.error);
