/**
 * chatbot/handlers/helpers.js - Fonctions partagees par les handlers
 */
const storage = require("../../services/storageService");
const { CLIENT_STATUTS, PROSPECT_STATUTS, OPPORTUNITY_STATUTS, OPEN_OPPORTUNITY_STATUTS } = require("../../constants");

const VALID_STATUTS = {
  clients: CLIENT_STATUTS,
  prospects: PROSPECT_STATUTS,
  opportunities: [...OPPORTUNITY_STATUTS, "ouvertes"],
  interactions: [],
};

const MAX_FETCH = 500;

/** Charge jusqu'a MAX_FETCH enregistrements (le CRM cible reste de taille moderee). */
async function fetchAll(type, { filters, search } = {}) {
  const r = await storage.findAll(type, { limit: MAX_FETCH, page: 1, filters, search });
  return { data: r.data, total: r.total, truncated: r.total > r.data.length };
}

/** Determine le type de ressource : explicite, deduit du statut, ou du contexte. */
function inferType(entities, state, fallback) {
  if (entities.entityType) return entities.entityType;
  if (entities.statutScope) return entities.statutScope;
  if (entities.interactionType) return "interactions";
  return fallback || (state && state.lastResource) || null;
}

/** Applique statut / famille "ouvertes" sur une liste en memoire. */
function applyStatut(list, statut) {
  if (!statut) return list;
  if (statut === "ouvertes") return list.filter((r) => OPEN_OPPORTUNITY_STATUTS.includes(r.statut));
  return list.filter((r) => r.statut === statut);
}

/** Filtre par periode sur un champ de date. */
function applyPeriod(list, period, field = "created_at") {
  if (!period) return list;
  return list.filter((r) => {
    const raw = r[field] || r.created_at;
    const d = new Date(raw);
    return d >= period.from && d <= period.to;
  });
}

function applyAmount(list, constraint, field = "montant") {
  if (!constraint) return list;
  return list.filter((r) => {
    const v = Number(r[field]) || 0;
    if (constraint.min !== undefined && v < constraint.min) return false;
    if (constraint.max !== undefined && v > constraint.max) return false;
    return true;
  });
}

/** Reference minimale stockee dans l'etat (dernier enregistrement evoque). */
function recordRef(type, r) {
  return { type, id: r.id, nom: r.nom || r.titre || r.sujet };
}

const isOverdue = (opp, now) => opp.date_cloture && new Date(opp.date_cloture) < new Date(now.getFullYear(), now.getMonth(), now.getDate());

function daysBetween(a, b) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

module.exports = { VALID_STATUTS, MAX_FETCH, fetchAll, inferType, applyStatut, applyPeriod, applyAmount, recordRef, isOverdue, daysBetween };
