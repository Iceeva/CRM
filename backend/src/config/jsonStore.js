/**
 * config/jsonStore.js - Fichier JSON de secours (lecture / ecriture)
 * ----------------------------------------------------------------------------
 * - Local : backend/data/data.json
 * - Vercel : le disque est en lecture seule sauf /tmp. Au premier acces, le
 *   fichier de demonstration embarque est copie vers /tmp/crm-data.json.
 *   Ces donnees sont EPHEMERES (perdues au redemarrage de la fonction) :
 *   utilisez Neon pour de la persistance.
 * - Ecriture atomique : ecriture dans un fichier temporaire puis rename,
 *   pour ne jamais laisser un JSON tronque en cas d'arret brutal.
 */
const fs = require("fs");
const path = require("path");
const { env } = require("./env");

const COLLECTIONS = ["users", "clients", "prospects", "interactions", "opportunities", "chat_messages"];

function emptyData() {
  const d = {};
  COLLECTIONS.forEach((c) => (d[c] = []));
  return d;
}

/** Garantit la presence de toutes les collections attendues. */
function withCollections(data) {
  const out = { ...data };
  COLLECTIONS.forEach((c) => {
    if (!Array.isArray(out[c])) out[c] = [];
  });
  return out;
}

/** Copie le jeu de donnees de demonstration si le fichier cible n'existe pas. */
function ensureFile() {
  const file = env.JSON_STORE_PATH;
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (env.JSON_SEED_PATH !== file && fs.existsSync(env.JSON_SEED_PATH)) {
    fs.copyFileSync(env.JSON_SEED_PATH, file);
  } else {
    fs.writeFileSync(file, JSON.stringify(emptyData(), null, 2), "utf-8");
  }
}

/** Lit toutes les donnees. */
function readData() {
  try {
    ensureFile();
    const raw = fs.readFileSync(env.JSON_STORE_PATH, "utf-8");
    return withCollections(JSON.parse(raw));
  } catch (err) {
    console.error("[json] Erreur de lecture :", err.message);
    return emptyData();
  }
}

/** Ecrit toutes les donnees (ecriture atomique). */
function writeData(data) {
  const file = env.JSON_STORE_PATH;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error("[json] Erreur d'ecriture :", err.message);
    throw err;
  }
}

module.exports = { readData, writeData, COLLECTIONS, emptyData };
