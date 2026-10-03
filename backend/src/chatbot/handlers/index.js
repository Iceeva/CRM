/**
 * chatbot/handlers/index.js - Registre des handlers
 * Lien entre l'identifiant `handler` d'une intention et sa fonction.
 */
const social = require("./social");
const read = require("./read");
const write = require("./write");

/** Handlers de consultation / conversation : (ctx) => Promise<result>. */
const READ_HANDLERS = { ...social, ...read };

/** Actions d'ecriture : objets { fill, resolve, summary, execute }. */
const WRITE_HANDLERS = write;

module.exports = { READ_HANDLERS, WRITE_HANDLERS };
