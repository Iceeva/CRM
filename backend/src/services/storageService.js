/**
 * services/storageService.js - Facade de stockage Neon (Prisma) / JSON
 * ----------------------------------------------------------------------------
 * API unique utilisee par les controleurs ET par le chatbot :
 *
 *   findAll(collection, { search, page, limit, filters })
 *   findById(collection, id)
 *   create(collection, record)
 *   update(collection, id, fields)
 *   remove(collection, id)
 *   count(collection, filters)
 *   sum(collection, field, filters)
 *   groupCount(collection, field, filters)
 *   groupSum(collection, groupField, sumField, filters)
 *   isPostgres() / status()
 *
 * Strategie :
 *   1. Si DATABASE_URL est definie et Neon repond -> Prisma.
 *   2. Sinon (ou si une erreur de connexion survient en cours d'operation)
 *      -> bascule transparente sur le fichier JSON.
 *   3. Le re-test de Neon se fait a la demande, toutes les DB_RECHECK_MS.
 *
 * Attention : les deux stockages sont independants. Les donnees ecrites en mode
 * JSON ne sont pas rejouees vers Neon automatiquement (voir docs/DATABASE.md).
 */
const db = require("../config/prisma");
const prismaStore = require("../stores/prismaStore");
const jsonStore = require("../stores/jsonCollectionStore");

/**
 * Execute `op` sur le bon moteur, avec bascule en cas d'erreur de connexion.
 * @param {keyof typeof prismaStore} op
 */
async function run(op, ...args) {
  if (await db.shouldUseDatabase()) {
    try {
      return await prismaStore[op](...args);
    } catch (err) {
      if (!db.isConnectionError(err)) throw err; // erreur metier : on la remonte
      db.markDown(err);
    }
  }
  return jsonStore[op](...args);
}

module.exports = {
  findAll: (collection, opts) => run("findAll", collection, opts),
  findById: (collection, id) => run("findById", collection, id),
  create: (collection, record) => run("create", collection, record),
  update: (collection, id, fields) => run("update", collection, id, fields),
  remove: (collection, id) => run("remove", collection, id),
  count: (collection, filters) => run("count", collection, filters),
  sum: (collection, field, filters) => run("sum", collection, field, filters),
  groupCount: (collection, field, filters) => run("groupCount", collection, field, filters),
  groupSum: (collection, groupField, sumField, filters) =>
    run("groupSum", collection, groupField, sumField, filters),

  /** true si la derniere operation a utilise Neon */
  isPostgres: () => db.isConnected(),
  /** Etat detaille pour /api/health */
  status: () => db.status(),
  /** Force un test de connexion (demarrage, health check) */
  ping: () => db.testConnection(),
};
