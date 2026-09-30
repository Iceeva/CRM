/**
 * services/storageService.js
 * ──────────────────────────
 * Couche d'abstraction : chaque appel choisit automatiquement
 * PostgreSQL (si connecté) ou le fichier JSON (fallback).
 *
 * API uniforme utilisée par les controllers :
 *   storageService.findAll(collection, { search, page, limit, filters })
 *   storageService.findById(collection, id)
 *   storageService.create(collection, record)
 *   storageService.update(collection, id, fields)
 *   storageService.remove(collection, id)
 *   storageService.count(collection, filters)
 *   storageService.isPostgres()  → boolean
 */

const { pool, isConnected } = require("../config/db");
const { readData, writeData } = require("../config/jsonStore");
const { v4: uuidv4 } = require("uuid");

/* ───────── helpers internes ───────── */

function usePostgres() {
  // Accéder au getter dynamique
  return require("../config/db").isConnected;
}

// Mapping collection → table PostgreSQL
const TABLE_MAP = {
  users: "users",
  clients: "clients",
  prospects: "prospects",
  interactions: "interactions",
  opportunities: "opportunities",
};

/* ─────────────────────────────────────
   PostgreSQL helpers
   ───────────────────────────────────── */

async function pgFindAll(table, { search, page = 1, limit = 20, filters = {} } = {}) {
  const values = [];
  const conditions = [];
  let idx = 1;

  // Filtres exacts
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== "") {
      conditions.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }

  // Recherche texte (nom, email, entreprise)
  if (search) {
    conditions.push(
      `(LOWER(nom) LIKE $${idx} OR LOWER(email) LIKE $${idx} OR LOWER(COALESCE(entreprise,'')) LIKE $${idx})`
    );
    values.push(`%${search.toLowerCase()}%`);
    idx++;
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const offset = (page - 1) * limit;

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM ${table} ${where}`,
    values
  );
  const total = parseInt(countRes.rows[0].count, 10);

  values.push(limit, offset);
  const dataRes = await pool.query(
    `SELECT * FROM ${table} ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  return {
    data: dataRes.rows,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

async function pgFindById(table, id) {
  const res = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function pgCreate(table, record) {
  const id = record.id || uuidv4();
  const rec = { ...record, id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const keys = Object.keys(rec);
  const vals = Object.values(rec);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const res = await pool.query(
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    vals
  );
  return res.rows[0];
}

async function pgUpdate(table, id, fields) {
  fields.updated_at = new Date().toISOString();
  const keys = Object.keys(fields);
  const vals = Object.values(fields);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  vals.push(id);
  const res = await pool.query(
    `UPDATE ${table} SET ${setClause} WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  return res.rows[0] || null;
}

async function pgRemove(table, id) {
  const res = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
  return res.rows[0] || null;
}

async function pgCount(table, filters = {}) {
  const values = [];
  const conditions = [];
  let idx = 1;
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== "") {
      conditions.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const res = await pool.query(`SELECT COUNT(*) FROM ${table} ${where}`, values);
  return parseInt(res.rows[0].count, 10);
}

/* ─────────────────────────────────────
   JSON helpers
   ───────────────────────────────────── */

function jsonFindAll(collection, { search, page = 1, limit = 20, filters = {} } = {}) {
  const data = readData();
  let items = data[collection] || [];

  // Filtres exacts
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== "") {
      items = items.filter((i) => i[key] === val);
    }
  }

  // Recherche texte
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(
      (i) =>
        (i.nom || "").toLowerCase().includes(s) ||
        (i.email || "").toLowerCase().includes(s) ||
        (i.entreprise || "").toLowerCase().includes(s) ||
        (i.titre || "").toLowerCase().includes(s)
    );
  }

  // Tri par date décroissante
  items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return {
    data: paged,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

function jsonFindById(collection, id) {
  const data = readData();
  return (data[collection] || []).find((i) => i.id === id) || null;
}

function jsonCreate(collection, record) {
  const data = readData();
  if (!data[collection]) data[collection] = [];
  const newRec = {
    ...record,
    id: record.id || uuidv4(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  data[collection].push(newRec);
  writeData(data);
  return newRec;
}

function jsonUpdate(collection, id, fields) {
  const data = readData();
  const items = data[collection] || [];
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...fields, updated_at: new Date().toISOString() };
  writeData(data);
  return items[idx];
}

function jsonRemove(collection, id) {
  const data = readData();
  const items = data[collection] || [];
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const [removed] = items.splice(idx, 1);
  writeData(data);
  return removed;
}

function jsonCount(collection, filters = {}) {
  const data = readData();
  let items = data[collection] || [];
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== "") {
      items = items.filter((i) => i[key] === val);
    }
  }
  return items.length;
}

/* ─────────────────────────────────────
   Exports unifiés
   ───────────────────────────────────── */

module.exports = {
  isPostgres: () => usePostgres(),

  async findAll(collection, opts) {
    const table = TABLE_MAP[collection] || collection;
    return usePostgres()
      ? pgFindAll(table, opts)
      : jsonFindAll(collection, opts);
  },

  async findById(collection, id) {
    const table = TABLE_MAP[collection] || collection;
    return usePostgres() ? pgFindById(table, id) : jsonFindById(collection, id);
  },

  async create(collection, record) {
    const table = TABLE_MAP[collection] || collection;
    return usePostgres()
      ? pgCreate(table, record)
      : jsonCreate(collection, record);
  },

  async update(collection, id, fields) {
    const table = TABLE_MAP[collection] || collection;
    return usePostgres()
      ? pgUpdate(table, id, fields)
      : jsonUpdate(collection, id, fields);
  },

  async remove(collection, id) {
    const table = TABLE_MAP[collection] || collection;
    return usePostgres() ? pgRemove(table, id) : jsonRemove(collection, id);
  },

  async count(collection, filters) {
    const table = TABLE_MAP[collection] || collection;
    return usePostgres()
      ? pgCount(table, filters)
      : jsonCount(collection, filters);
  },
};
