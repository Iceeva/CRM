/**
 * utils/httpError.js - Erreur HTTP typee, interpretee par middlewares/errorHandler.js
 */
class HttpError extends Error {
  /**
   * @param {number} status   code HTTP (400, 401, 404, 409...)
   * @param {string} message  message affichable cote client
   * @param {object} [extra]  champs supplementaires (ex: { errors: [...] })
   */
  constructor(status, message, extra = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    Object.assign(this, extra);
  }
}

module.exports = { HttpError };
