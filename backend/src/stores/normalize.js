/**
 * stores/normalize.js - Conversion des donnees entrantes / sortantes
 * ----------------------------------------------------------------------------
 * Garantit que les deux moteurs de stockage (Prisma et JSON) exposent le meme
 * format a l'API : dates en ISO, montants en nombres, champs non declares
 * retires.
 */
const { meta, SYSTEM_FIELDS } = require("./schema");

/**
 * Prepare un objet pour l'ecriture : liste blanche + conversions de types.
 * @param {string} collection
 * @param {object} input
 * @param {{ target: "prisma"|"json", creating?: boolean }} opts
 */
function toStorage(collection, input, { target, creating = false } = {}) {
  const m = meta(collection);
  const allowed = new Set([...m.fields, ...(creating ? SYSTEM_FIELDS : [])]);
  const out = {};

  for (const [key, value] of Object.entries(input || {})) {
    if (!allowed.has(key) || value === undefined) continue;
    out[key] = value;
  }

  for (const f of m.dateFields) {
    if (!(f in out)) continue;
    const v = out[f];
    if (v === null || v === "") {
      // Colonne obligatoire (interactions.date) : on laisse la valeur par defaut
      if (f === "date") delete out[f];
      else out[f] = null;
      continue;
    }
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      const err = new Error(`Date invalide pour le champ ${f}`);
      err.status = 400;
      throw err;
    }
    if (target === "prisma") out[f] = d;
    else out[f] = m.dateOnly.includes(f) ? d.toISOString().slice(0, 10) : d.toISOString();
  }

  for (const f of m.numberFields) {
    if (f in out && out[f] !== null) {
      const n = Number(out[f]);
      out[f] = Number.isFinite(n) ? n : 0;
    }
  }

  if (target === "prisma" && creating) {
    for (const f of SYSTEM_FIELDS) {
      if (typeof out[f] === "string") out[f] = new Date(out[f]);
    }
  }
  return out;
}

/** Convertit une ligne Prisma en objet JSON simple (dates ISO, Decimal -> number). */
function fromPrisma(collection, row) {
  if (!row) return null;
  const m = meta(collection);
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      out[key] = m.dateOnly.includes(key) ? value.toISOString().slice(0, 10) : value.toISOString();
    } else if (value && typeof value === "object" && typeof value.toNumber === "function") {
      out[key] = value.toNumber();
    } else {
      out[key] = value;
    }
  }
  return out;
}

module.exports = { toStorage, fromPrisma };
