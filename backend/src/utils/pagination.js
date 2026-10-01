/**
 * utils/pagination.js - Lecture securisee des parametres ?page= et ?limit=
 */

/**
 * @param {object} query  req.query
 * @param {{defaultLimit?: number, maxLimit?: number}} [opts]
 * @returns {{page: number, limit: number}}
 */
function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 500 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit };
}

module.exports = { parsePagination };
