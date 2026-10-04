/**
 * chatbot/engine/state.js - Etat de conversation (sans memoire serveur)
 * ----------------------------------------------------------------------------
 * Le serveur ne garde AUCUN etat entre deux requetes (indispensable sur Vercel,
 * ou chaque appel peut tomber sur une instance differente). L'etat du dialogue
 * est donc renvoye au client dans chaque reponse, puis rappele dans la requete
 * suivante.
 *
 * Comme le client est maitre de cet objet, il est TOUJOURS assaini ici :
 * liste blanche de cles, types verifies, tailles limitees. Une action
 * d'ecriture n'est executee que si l'utilisateur confirme explicitement, et
 * les droits d'acces restent ceux de l'API authentifiee.
 */
const { INTENTS } = require("../intents");

const INTENT_IDS = new Set(INTENTS.map((i) => i.id));
const RESOURCE_TYPES = new Set(["clients", "prospects", "opportunities", "interactions"]);
const PENDING_KINDS = new Set(["slots", "confirm", "choose", "disambiguate"]);

const str = (v, max = 300) => (typeof v === "string" ? v.slice(0, max) : undefined);

function newState() {
  return { turns: 0, lastIntent: null, lastResource: null, lastRecord: null, lastEntities: {}, pending: null };
}

function sanitizeRecordRef(r) {
  if (!r || typeof r !== "object") return null;
  if (!RESOURCE_TYPES.has(r.type) || typeof r.id !== "string") return null;
  return { type: r.type, id: str(r.id, 64), nom: str(r.nom, 255) };
}

function sanitizeSlots(slots) {
  const out = {};
  if (!slots || typeof slots !== "object") return out;
  for (const [k, v] of Object.entries(slots).slice(0, 12)) {
    if (!/^[a-z_]{1,24}$/.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 2000);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (v && typeof v === "object" && RESOURCE_TYPES.has(v.type) && typeof v.id === "string") out[k] = sanitizeRecordRef(v);
  }
  return out;
}

function sanitizePending(p) {
  if (!p || typeof p !== "object" || !PENDING_KINDS.has(p.kind) || !INTENT_IDS.has(p.intent)) return null;
  const out = { kind: p.kind, intent: p.intent, slots: sanitizeSlots(p.slots) };
  if (Array.isArray(p.missing)) out.missing = p.missing.filter((m) => typeof m === "string" && /^[a-z_]{1,24}$/.test(m)).slice(0, 8);
  if (typeof p.awaiting === "string" && /^[a-z_]{1,24}$/.test(p.awaiting)) out.awaiting = p.awaiting;
  if (Array.isArray(p.options)) {
    out.options = p.options
      .slice(0, 6)
      .map((o) => ({ id: str(o && o.id, 80), label: str(o && o.label, 120), type: RESOURCE_TYPES.has(o && o.type) ? o.type : undefined }))
      .filter((o) => o.id);
  }
  // Informations de la phrase d'origine a conserver pendant un choix (liste blanche stricte)
  if (p.carry && typeof p.carry === "object") {
    const c = {};
    for (const k of ["field", "interactionType", "entityType", "statut", "company", "title"]) if (typeof p.carry[k] === "string") c[k] = p.carry[k].slice(0, 200);
    for (const k of ["names", "emails", "phones"]) if (Array.isArray(p.carry[k])) c[k] = p.carry[k].filter((x) => typeof x === "string").slice(0, 3).map((x) => x.slice(0, 200));
    for (const k of ["amount"]) if (typeof p.carry[k] === "number" && Number.isFinite(p.carry[k])) c[k] = p.carry[k];
    if (typeof p.carry.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.carry.date)) c.date = p.carry.date;
    out.carry = c;
  }
  if (typeof p.ttl === "number") out.ttl = Math.max(0, Math.min(6, Math.floor(p.ttl)));
  return out;
}

/** Assainit l'etat recu du client. */
function sanitizeState(raw) {
  const s = newState();
  if (!raw || typeof raw !== "object") return s;
  s.turns = Math.max(0, Math.min(10000, parseInt(raw.turns, 10) || 0));
  s.lastIntent = INTENT_IDS.has(raw.lastIntent) ? raw.lastIntent : null;
  s.lastResource = RESOURCE_TYPES.has(raw.lastResource) ? raw.lastResource : null;
  s.lastRecord = sanitizeRecordRef(raw.lastRecord);
  const e = raw.lastEntities && typeof raw.lastEntities === "object" ? raw.lastEntities : {};
  s.lastEntities = {};
  if (RESOURCE_TYPES.has(e.entityType)) s.lastEntities.entityType = e.entityType;
  if (typeof e.statut === "string") s.lastEntities.statut = e.statut.slice(0, 30);
  if (typeof e.field === "string") s.lastEntities.field = e.field.slice(0, 30);
  s.pending = sanitizePending(raw.pending);
  return s;
}

module.exports = { newState, sanitizeState };
