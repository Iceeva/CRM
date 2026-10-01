/**
 * constants.js - Valeurs metier partagees
 * ----------------------------------------------------------------------------
 * Source unique de verite pour les statuts et types : utilisee par les
 * controleurs (validation) ET par le moteur du chatbot (reconnaissance
 * d'entites). Modifier une valeur ici la propage partout.
 */

const CLIENT_STATUTS = ["actif", "inactif"];
const PROSPECT_STATUTS = ["nouveau", "contacte", "converti"];
const OPPORTUNITY_STATUTS = [
  "prospection",
  "qualification",
  "proposition",
  "negociation",
  "gagnee",
  "perdue",
];
const INTERACTION_TYPES = ["appel", "email", "reunion", "note"];
const USER_ROLES = ["admin", "user"];

// Etapes "ouvertes" du pipeline (ni gagnee ni perdue)
const OPEN_OPPORTUNITY_STATUTS = ["prospection", "qualification", "proposition", "negociation"];

module.exports = {
  CLIENT_STATUTS,
  PROSPECT_STATUTS,
  OPPORTUNITY_STATUTS,
  OPEN_OPPORTUNITY_STATUTS,
  INTERACTION_TYPES,
  USER_ROLES,
};
