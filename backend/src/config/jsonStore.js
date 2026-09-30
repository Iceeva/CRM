/**
 * config/jsonStore.js — Stockage JSON local (fallback)
 * Lecture / écriture thread-safe dans data/data.json.
 */
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../../data/data.json");

// Structure par défaut
const DEFAULT_DATA = {
  users: [],
  clients: [],
  prospects: [],
  interactions: [],
  opportunities: [],
};

/**
 * Lit le fichier JSON. Crée le fichier s'il n'existe pas.
 */
function readData() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
      fs.writeFileSync(DATA_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
      return { ...DEFAULT_DATA };
    }
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("❌  Erreur lecture JSON :", err.message);
    return { ...DEFAULT_DATA };
  }
}

/**
 * Écrit l'objet data dans le fichier JSON.
 */
function writeData(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("❌  Erreur écriture JSON :", err.message);
  }
}

module.exports = { readData, writeData };
