/**
 * middlewares/schemas.js - Schemas de validation des ressources
 */
const {
  CLIENT_STATUTS,
  PROSPECT_STATUTS,
  OPPORTUNITY_STATUTS,
  INTERACTION_TYPES,
} = require("../constants");

const contact = {
  nom: { type: "string", max: 255 },
  email: { type: "email", max: 255 },
  telephone: { type: "string", max: 50 },
  entreprise: { type: "string", max: 255 },
  notes: { type: "string", max: 5000 },
};

module.exports = {
  register: {
    nom: { required: true, type: "string", max: 255 },
    email: { required: true, type: "email", max: 255 },
    password: { required: true, type: "string", min: 6, max: 128 },
  },
  login: {
    email: { required: true, type: "email", max: 255 },
    password: { required: true, type: "string", max: 128 },
  },

  clientCreate: {
    ...contact,
    nom: { required: true, type: "string", max: 255 },
    email: { required: true, type: "email", max: 255 },
    statut: { type: "enum", values: CLIENT_STATUTS },
  },
  clientUpdate: { ...contact, statut: { type: "enum", values: CLIENT_STATUTS } },

  prospectCreate: {
    ...contact,
    nom: { required: true, type: "string", max: 255 },
    email: { required: true, type: "email", max: 255 },
    source: { type: "string", max: 100 },
  },
  prospectUpdate: {
    ...contact,
    source: { type: "string", max: 100 },
    statut: { type: "enum", values: PROSPECT_STATUTS },
  },

  interactionCreate: {
    type: { required: true, type: "enum", values: INTERACTION_TYPES },
    sujet: { required: true, type: "string", max: 500 },
    contenu: { type: "string", max: 10000 },
    date: { type: "date" },
  },
  interactionUpdate: {
    type: { type: "enum", values: INTERACTION_TYPES },
    sujet: { type: "string", max: 500 },
    contenu: { type: "string", max: 10000 },
    date: { type: "date" },
  },

  opportunityCreate: {
    titre: { required: true, type: "string", max: 500 },
    montant: { type: "number", min: 0, max: 1e13 },
    statut: { type: "enum", values: OPPORTUNITY_STATUTS },
    description: { type: "string", max: 5000 },
    date_cloture: { type: "date" },
  },
  opportunityUpdate: {
    titre: { type: "string", max: 500 },
    montant: { type: "number", min: 0, max: 1e13 },
    statut: { type: "enum", values: OPPORTUNITY_STATUTS },
    description: { type: "string", max: 5000 },
    date_cloture: { type: "date" },
  },

  chatMessage: {
    message: { required: true, type: "string", max: 2000 },
  },
};
