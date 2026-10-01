/**
 * stores/prismaStore.js - Acces aux donnees via Prisma (Neon PostgreSQL)
 * ----------------------------------------------------------------------------
 * Memes signatures que stores/jsonCollectionStore.js : le service de stockage
 * peut donc appeler indifferemment l'un ou l'autre.
 */
const { getPrisma } = require("../config/prisma");
const { meta } = require("./schema");
const { toStorage, fromPrisma } = require("./normalize");
const { newId } = require("../utils/id");

function delegate(collection) {
  return getPrisma()[meta(collection).model];
}

function cleanFilters(collection, filters = {}) {
  const m = meta(collection);
  const allowed = new Set([...m.fields]);
  const out = {};
  for (const [k, v] of Object.entries(filters)) {
    if (!allowed.has(k) || v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

/** Construit la clause `where` Prisma (filtres exacts + recherche insensible a la casse). */
function buildWhere(collection, { search, filters } = {}) {
  const m = meta(collection);
  const where = { ...cleanFilters(collection, filters) };
  const s = (search || "").trim();
  if (s) {
    where.OR = m.searchFields.map((f) => ({ [f]: { contains: s, mode: "insensitive" } }));
  }
  return where;
}

async function findAll(collection, { search, page = 1, limit = 20, filters = {} } = {}) {
  const m = meta(collection);
  const where = buildWhere(collection, { search, filters });
  const d = delegate(collection);

  const [total, rows] = await getPrisma().$transaction([
    d.count({ where }),
    d.findMany({
      where,
      orderBy: [{ [m.orderBy]: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: rows.map((r) => fromPrisma(collection, r)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function findById(collection, id) {
  const row = await delegate(collection).findUnique({ where: { id: String(id) } });
  return fromPrisma(collection, row);
}

async function create(collection, record) {
  const data = toStorage(collection, record, { target: "prisma", creating: true });
  if (!data.id) data.id = newId();
  const row = await delegate(collection).create({ data });
  return fromPrisma(collection, row);
}

async function update(collection, id, fields) {
  const data = toStorage(collection, fields, { target: "prisma" });
  delete data.id;
  try {
    const row = await delegate(collection).update({ where: { id: String(id) }, data });
    return fromPrisma(collection, row);
  } catch (err) {
    if (err.code === "P2025") return null; // enregistrement introuvable
    throw err;
  }
}

async function remove(collection, id) {
  try {
    const row = await delegate(collection).delete({ where: { id: String(id) } });
    return fromPrisma(collection, row);
  } catch (err) {
    if (err.code === "P2025") return null;
    throw err;
  }
}

async function count(collection, filters = {}) {
  return delegate(collection).count({ where: cleanFilters(collection, filters) });
}

/** Somme d'un champ numerique. */
async function sum(collection, field, filters = {}) {
  const r = await delegate(collection).aggregate({
    _sum: { [field]: true },
    where: cleanFilters(collection, filters),
  });
  const v = r._sum[field];
  return v === null || v === undefined ? 0 : Number(v);
}

/** { valeur: nombre } : decompte par valeur d'un champ. */
async function groupCount(collection, field, filters = {}) {
  const rows = await delegate(collection).groupBy({
    by: [field],
    _count: { _all: true },
    where: cleanFilters(collection, filters),
    orderBy: { [field]: "asc" },
  });
  return Object.fromEntries(rows.map((r) => [r[field], r._count._all]));
}

/** { valeur: somme } : somme d'un champ numerique par valeur d'un autre champ. */
async function groupSum(collection, groupField, sumField, filters = {}) {
  const rows = await delegate(collection).groupBy({
    by: [groupField],
    _sum: { [sumField]: true },
    where: cleanFilters(collection, filters),
    orderBy: { [groupField]: "asc" },
  });
  return Object.fromEntries(rows.map((r) => [r[groupField], Number(r._sum[sumField] || 0)]));
}

module.exports = { findAll, findById, create, update, remove, count, sum, groupCount, groupSum };
