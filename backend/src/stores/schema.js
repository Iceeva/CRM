/**
 * stores/schema.js - Metadonnees des collections
 * ----------------------------------------------------------------------------
 * Decrit pour chaque collection :
 *  - model        : nom du delegue Prisma (prisma.client, prisma.prospect...)
 *  - fields       : champs autorises en ecriture / filtrage (liste blanche)
 *  - searchFields : champs parcourus par la recherche texte ?search=
 *  - dateFields   : champs convertis en Date pour Prisma
 *  - dateOnly     : champs de type DATE (sans heure), serialises "YYYY-MM-DD"
 *  - numberFields : champs numeriques (Decimal / Float)
 *  - orderBy      : champ de tri decroissant par defaut
 *  - unique       : champs uniques (verifies aussi en mode JSON)
 *  - references   : cles etrangeres verifiees en mode JSON
 *  - cascade      : comportement en mode JSON a la suppression (miroir du schema Prisma)
 */
const COLLECTIONS = {
  users: {
    model: "user",
    fields: ["id", "nom", "email", "password", "role"],
    searchFields: ["nom", "email"],
    unique: ["email"],
  },
  clients: {
    model: "client",
    fields: ["id", "nom", "email", "telephone", "entreprise", "statut", "notes", "source"],
    searchFields: ["nom", "email", "entreprise", "telephone"],
  },
  prospects: {
    model: "prospect",
    fields: ["id", "nom", "email", "telephone", "entreprise", "source", "statut", "notes"],
    searchFields: ["nom", "email", "entreprise", "telephone"],
  },
  interactions: {
    model: "interaction",
    fields: ["id", "client_id", "prospect_id", "type", "sujet", "contenu", "date"],
    searchFields: ["sujet", "contenu"],
    dateFields: ["date"],
    orderBy: "date",
    references: { client_id: "clients", prospect_id: "prospects" },
  },
  opportunities: {
    model: "opportunity",
    fields: ["id", "client_id", "titre", "montant", "statut", "description", "date_cloture"],
    searchFields: ["titre", "description"],
    dateFields: ["date_cloture"],
    dateOnly: ["date_cloture"],
    numberFields: ["montant"],
    references: { client_id: "clients" },
  },
  chat_messages: {
    model: "chatMessage",
    fields: ["id", "user_id", "session_id", "role", "content", "intent", "confidence", "engine"],
    searchFields: ["content"],
    numberFields: ["confidence"],
    references: { user_id: "users" },
  },
};

// Champs systeme acceptes uniquement a la creation (import / seed)
const SYSTEM_FIELDS = ["created_at", "updated_at"];

// Regles de suppression appliquees en mode JSON (equivalent des onDelete Prisma)
const CASCADE = {
  clients: [
    { collection: "interactions", field: "client_id", action: "delete" },
    { collection: "opportunities", field: "client_id", action: "nullify" },
  ],
  prospects: [{ collection: "interactions", field: "prospect_id", action: "nullify" }],
  users: [{ collection: "chat_messages", field: "user_id", action: "delete" }],
};

/** @returns {object} les metadonnees de la collection (leve une erreur si inconnue) */
function meta(collection) {
  const m = COLLECTIONS[collection];
  if (!m) throw new Error(`Collection inconnue : ${collection}`);
  return { orderBy: "created_at", dateFields: [], dateOnly: [], numberFields: [], unique: [], references: {}, ...m };
}

module.exports = { COLLECTIONS, SYSTEM_FIELDS, CASCADE, meta };
