/**
 * stores/jsonCollectionStore.js - Acces aux donnees via le fichier JSON
 * ----------------------------------------------------------------------------
 * Reproduit le comportement du store Prisma : recherche, pagination, tri,
 * unicite, verification des references et suppression en cascade.
 */
const { readData, writeData } = require("../config/jsonStore");
const { meta, CASCADE } = require("./schema");
const { toStorage } = require("./normalize");
const { newId } = require("../utils/id");

function fkError(field) {
  const err = new Error(`Reference inexistante : ${field}`);
  err.code = "P2003";
  err.status = 400;
  return err;
}

function uniqueError(field) {
  const err = new Error(`Valeur deja utilisee : ${field}`);
  err.code = "P2002";
  err.status = 409;
  return err;
}

function matchesFilters(item, filters = {}) {
  return Object.entries(filters).every(([k, v]) => {
    if (v === undefined || v === null || v === "") return true;
    return String(item[k]) === String(v);
  });
}

function matchesSearch(item, searchFields, search) {
  const s = (search || "").trim().toLowerCase();
  if (!s) return true;
  return searchFields.some((f) => String(item[f] || "").toLowerCase().includes(s));
}

function sortDesc(items, field) {
  return items.sort((a, b) => {
    const va = new Date(a[field] || a.created_at || 0).getTime();
    const vb = new Date(b[field] || b.created_at || 0).getTime();
    return vb - va;
  });
}

async function findAll(collection, { search, page = 1, limit = 20, filters = {} } = {}) {
  const m = meta(collection);
  const all = readData()[collection] || [];
  const items = sortDesc(
    all.filter((i) => matchesFilters(i, filters) && matchesSearch(i, m.searchFields, search)),
    m.orderBy
  );
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function findById(collection, id) {
  return (readData()[collection] || []).find((i) => i.id === String(id)) || null;
}

function checkReferences(data, collection, record) {
  const m = meta(collection);
  for (const [field, target] of Object.entries(m.references)) {
    const value = record[field];
    if (value === null || value === undefined || value === "") continue;
    if (!(data[target] || []).some((r) => r.id === value)) throw fkError(field);
  }
}

function checkUnique(data, collection, record, selfId = null) {
  const m = meta(collection);
  for (const field of m.unique) {
    if (record[field] === undefined) continue;
    const dup = (data[collection] || []).some(
      (r) => r.id !== selfId && String(r[field]).toLowerCase() === String(record[field]).toLowerCase()
    );
    if (dup) throw uniqueError(field);
  }
}

async function create(collection, record) {
  const data = readData();
  const clean = toStorage(collection, record, { target: "json", creating: true });
  const now = new Date().toISOString();
  const row = { ...clean, id: clean.id || newId(), created_at: clean.created_at || now, updated_at: clean.updated_at || now };

  // Valeurs par defaut equivalentes a celles du schema Prisma
  if (collection === "interactions" && !row.date) row.date = now;
  if (collection === "opportunities" && row.montant === undefined) row.montant = 0;

  checkReferences(data, collection, row);
  checkUnique(data, collection, row);
  data[collection] = data[collection] || [];
  data[collection].push(row);
  writeData(data);
  return row;
}

async function update(collection, id, fields) {
  const data = readData();
  const items = data[collection] || [];
  const idx = items.findIndex((i) => i.id === String(id));
  if (idx === -1) return null;

  const clean = toStorage(collection, fields, { target: "json" });
  delete clean.id;
  const next = { ...items[idx], ...clean, updated_at: new Date().toISOString() };
  checkReferences(data, collection, next);
  checkUnique(data, collection, next, next.id);
  items[idx] = next;
  writeData(data);
  return next;
}

async function remove(collection, id) {
  const data = readData();
  const items = data[collection] || [];
  const idx = items.findIndex((i) => i.id === String(id));
  if (idx === -1) return null;
  const [removed] = items.splice(idx, 1);

  // Cascade (miroir des onDelete du schema Prisma)
  for (const rule of CASCADE[collection] || []) {
    const target = data[rule.collection] || [];
    if (rule.action === "delete") {
      data[rule.collection] = target.filter((r) => r[rule.field] !== removed.id);
    } else {
      target.forEach((r) => {
        if (r[rule.field] === removed.id) r[rule.field] = null;
      });
    }
  }
  writeData(data);
  return removed;
}

async function count(collection, filters = {}) {
  return (readData()[collection] || []).filter((i) => matchesFilters(i, filters)).length;
}

async function sum(collection, field, filters = {}) {
  return (readData()[collection] || [])
    .filter((i) => matchesFilters(i, filters))
    .reduce((acc, i) => acc + (Number(i[field]) || 0), 0);
}

async function groupCount(collection, field, filters = {}) {
  const out = {};
  (readData()[collection] || [])
    .filter((i) => matchesFilters(i, filters))
    .forEach((i) => {
      const k = i[field];
      out[k] = (out[k] || 0) + 1;
    });
  return out;
}

async function groupSum(collection, groupField, sumField, filters = {}) {
  const out = {};
  (readData()[collection] || [])
    .filter((i) => matchesFilters(i, filters))
    .forEach((i) => {
      const k = i[groupField];
      out[k] = (out[k] || 0) + (Number(i[sumField]) || 0);
    });
  return out;
}

module.exports = { findAll, findById, create, update, remove, count, sum, groupCount, groupSum };
