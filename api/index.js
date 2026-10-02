/**
 * api/index.js - Point d'entree serverless pour Vercel
 * ----------------------------------------------------------------------------
 * Vercel transforme ce fichier en Serverless Function. Le fichier vercel.json
 * redirige toutes les URL /api/* vers cette fonction ; l'application Express
 * (backend/src/app.js) se charge ensuite du routage interne.
 *
 * Aucun app.listen() ici : Vercel appelle directement le handler exporte.
 */
const { validateEnv } = require("../backend/src/config/env");
const app = require("../backend/src/app");

// Valide la configuration a froid (leve une erreur claire si JWT_SECRET manque)
validateEnv().forEach((w) => console.warn("[config]", w));

module.exports = app;
