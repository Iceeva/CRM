/**
 * chatbot/engine/dialog.js - Gestionnaire de dialogue multi-tours
 * ----------------------------------------------------------------------------
 * Gere tout ce qui depasse la simple "une question, une reponse" :
 *
 *   - remplissage de slots   : "Quel est le nom du client ?" -> "Marie Curie"
 *   - confirmation           : resume de l'action puis "oui" / "non"
 *   - choix entre candidats  : "Plusieurs clients correspondent, lequel ?"
 *   - desambiguisation       : "Voulez-vous le nombre ou la liste ?"
 *   - annulation et changement de sujet a tout moment
 *
 * Toutes les fonctions retournent { result, state } ou null si le message n'est
 * pas une reponse au dialogue en cours (le moteur classe alors normalement).
 */
const { BY_ID } = require("../intents");
const { WRITE_HANDLERS } = require("../handlers");
const { analyze } = require("../nlp/tokenizer");
const { EMAIL_RE } = require("../../middlewares/validate");

const PENDING_TTL = 6; // nombre de tours avant abandon automatique

const CONFIRM_REPLIES = ["Oui, confirmer", "Non, annuler"];

/** Nom lisible d'un slot dans les messages. */
const SLOT_LABEL = { nom: "nom", email: "email", titre: "intitule", montant: "montant", cible: "enregistrement", type: "type", statut: "statut" };

const first = (v) => (Array.isArray(v) ? v[0] : v);
const isRef = (v) => v && typeof v === "object" && v.id;

/* ------------------------------------------------------------------ */
/*  Remplissage de slots                                               */
/* ------------------------------------------------------------------ */

/** Slots obligatoires manquants (dans l'ordre de declaration). */
function missingSlots(intent, slots) {
  return (intent.slots || []).filter((s) => s.required && (slots[s.name] === undefined || slots[s.name] === null || slots[s.name] === "")).map((s) => s.name);
}

/** Interprete la reponse libre de l'utilisateur pour un slot precis. */
function interpretAnswer(slotName, text, entities) {
  const raw = String(text).trim();
  switch (slotName) {
    case "email": {
      const e = first(entities.emails) || (raw.match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/) || [])[0];
      return e ? { value: e.toLowerCase() } : { error: "Je n'ai pas reconnu d'adresse email. Exemple : prenom.nom@entreprise.com" };
    }
    case "montant": {
      let v = entities.amount;
      if (v === undefined) {
        const m = raw.replace(/\s/g, "").replace(",", ".").match(/^(\d+(?:\.\d+)?)(k)?(?:eur|euros?|e|€)?$/i);
        if (m) v = parseFloat(m[1]) * (m[2] ? 1000 : 1);
      }
      return v !== undefined && v >= 0 ? { value: v } : { error: "Je n'ai pas compris le montant. Exemple : 12000 ou 12 000 euros" };
    }
    case "type": {
      const t = entities.interactionType || (["appel", "email", "reunion", "note"].find((x) => analyze(raw).clean.includes(x)));
      return t ? { value: t } : { error: "Choisissez parmi : appel, email, reunion ou note." };
    }
    case "statut":
      return entities.statut && entities.statut !== "ouvertes" ? { value: entities.statut } : { error: "Je n'ai pas reconnu ce statut." };
    case "date":
      return entities.date ? { value: entities.date } : { error: "Je n'ai pas compris la date. Exemple : 12/10/2026 ou demain" };
    case "nom":
    case "cible":
    case "client": {
      const v = first(entities.names) || entities.company || (entities.residual && entities.residual.length ? entities.residual.join(" ") : null) || raw;
      return v && v.length >= 2 ? { value: v.slice(0, 255) } : { error: "Pouvez-vous preciser un nom ?" };
    }
    case "titre":
    case "sujet": {
      const v = first(entities.quoted) || raw;
      return v.length >= 3 ? { value: v.slice(0, 500) } : { error: "L'intitule doit contenir au moins 3 caracteres." };
    }
    default:
      return raw ? { value: raw.slice(0, 500) } : { error: "Je n'ai pas compris, pouvez-vous reformuler ?" };
  }
}

/**
 * Fait avancer une action d'ecriture : remplit, resout, pose la prochaine question
 * ou demande confirmation.
 * @returns {Promise<{result: object, pending: object|null}>}
 */
async function advanceWrite(intentId, slots, ctx) {
  const intent = BY_ID[intentId];
  const action = WRITE_HANDLERS[intent.handler];

  // 1. Resolution des references (client, prospect, opportunite)
  const resolved = await action.resolve(slots, ctx);
  slots = resolved.slots;
  if (resolved.problem) {
    if (resolved.final) return { result: resolved.problem, pending: null };
    const p = resolved.problem;
    if (p.choose) {
      return { result: { reply: p.reply, quickReplies: p.choose.map((o) => o.label) }, pending: { kind: "choose", intent: intentId, slots, options: p.choose, ttl: PENDING_TTL } };
    }
    // Reference introuvable ou valeur invalide : on repose la question correspondante
    const awaiting = resolved.invalid || (intent.slots || []).find((s) => s.required && slots[s.name] === undefined)?.name || "cible";
    return { result: { reply: p.reply, quickReplies: p.quickReplies }, pending: { kind: "slots", intent: intentId, slots, awaiting, ttl: PENDING_TTL } };
  }

  // 2. Slots obligatoires manquants ?
  const missing = missingSlots(intent, slots);
  if (missing.length) {
    const next = intent.slots.find((s) => s.name === missing[0]);
    const quick = next.name === "type" ? ["appel", "email", "reunion", "note"] : undefined;
    return {
      result: { reply: next.prompt, quickReplies: quick },
      pending: { kind: "slots", intent: intentId, slots, awaiting: next.name, ttl: PENDING_TTL },
    };
  }

  // 3. Tout est complet : demande de confirmation
  return {
    result: { reply: `${action.summary(slots)}\n\nConfirmez-vous ?`, quickReplies: CONFIRM_REPLIES },
    pending: { kind: "confirm", intent: intentId, slots, ttl: PENDING_TTL },
  };
}

/** Demarre une action d'ecriture a partir de la phrase initiale. */
async function startWrite(intentId, entities, ctx) {
  const intent = BY_ID[intentId];
  const action = WRITE_HANDLERS[intent.handler];
  const slots = action.fill(entities, {}, ctx);
  // Nom en minuscules devine a partir des mots inconnus : on le propose comme valeur
  if (slots._nomGuess && !slots.nom) {
    slots.nom = slots._nomGuess;
  }
  delete slots._nomGuess;
  return advanceWrite(intentId, slots, ctx);
}

/* ------------------------------------------------------------------ */
/*  Traitement d'une reponse a un dialogue en cours                    */
/* ------------------------------------------------------------------ */

/**
 * @returns {Promise<null | {result: object, pending: object|null, executed?: boolean, switchTo?: string}>}
 */
async function handlePending(text, state, ctx, classification) {
  const p = state.pending;
  if (!p) return null;
  const entities = classification.entities;
  const intent = BY_ID[p.intent];

  // Annulation explicite, partout
  const cancelWords = /\b(annule|annuler|laisse tomber|oublie|stop|abandonne|arrete)\b/.test(classification.analysis.clean);
  if (entities.no || cancelWords) {
    return { result: { reply: p.kind === "confirm" ? "D'accord, rien n'a ete modifie." : "Action annulee.", quickReplies: [] }, pending: null };
  }

  // Changement de sujet : une autre intention tres claire prend le dessus
  const top = classification.candidates[0];
  if (top && top.id !== p.intent && classification.confidence >= 0.85 && top.pat >= 0.5 && !entities.yes) {
    return { switchTo: top.id };
  }

  /* ---- confirmation ---- */
  if (p.kind === "confirm") {
    if (entities.yes) {
      const action = WRITE_HANDLERS[intent.handler];
      // Dernier controle avant ecriture (la donnee a pu changer entre-temps)
      const again = await action.resolve({ ...p.slots }, ctx);
      if (again.problem) return { result: { reply: again.problem.reply }, pending: null };
      try {
        const out = await action.execute(again.slots, ctx);
        return { result: out, pending: null, executed: true };
      } catch (err) {
        return { result: { reply: `L'action a echoue : ${err.message || "erreur inconnue"}. Rien n'a ete enregistre.` }, pending: null };
      }
    }
    // Ni oui ni non : on reformule
    return { result: { reply: "Je n'ai pas compris. Souhaitez-vous confirmer l'action ? (oui / non)", quickReplies: CONFIRM_REPLIES }, pending: p };
  }

  /* ---- choix entre candidats ---- */
  if (p.kind === "choose") {
    const clean = classification.analysis.clean;
    let chosen = null;
    const num = clean.match(/^(?:le |la )?(\d)\b/) || clean.match(/\b(premier|premiere|deuxieme|second|seconde|troisieme)\b/);
    if (num) {
      const idx = { premier: 1, premiere: 1, deuxieme: 2, second: 2, seconde: 2, troisieme: 3 }[num[1]] || parseInt(num[1], 10);
      chosen = p.options[idx - 1];
    }
    if (!chosen) {
      const cleaned = (o) => analyze(o.label).clean;
      chosen = p.options.find((o) => clean.includes(cleaned(o)) || cleaned(o).includes(clean));
      if (!chosen) {
        const words = clean.split(" ").filter((w) => w.length >= 3);
        const hits = p.options.filter((o) => words.some((w) => cleaned(o).split(" ").includes(w)));
        if (hits.length === 1) chosen = hits[0];
      }
    }
    if (!chosen) return { result: { reply: "Je n'ai pas identifie votre choix. Cliquez sur l'une des options ou donnez un numero (1, 2...).", quickReplies: p.options.map((o) => o.label) }, pending: { ...p, ttl: PENDING_TTL } };

    const label = String(chosen.label).replace(/\s*\((client|prospect|opportunite)\)\s*$/, "");
    const ref = { type: chosen.type || "clients", id: chosen.id, nom: label };

    // Choix d'une intention (desambiguisation)
    if (!chosen.type) return { switchTo: chosen.id, carry: p.carry || {} };

    // Choix d'un enregistrement : on le range dans le slot qui attendait une reference
    if (p.intent && WRITE_HANDLERS[BY_ID[p.intent].handler]) {
      const slots = { ...p.slots };
      const refSlot = (BY_ID[p.intent].slots || []).find((s) => ["cible", "client"].includes(s.name) && !isRef(slots[s.name]));
      if (refSlot) slots[refSlot.name] = ref;
      return advanceWrite(p.intent, slots, ctx);
    }
    // Choix d'un enregistrement pour une lecture : on relance l'intention sur CET enregistrement
    return { rerun: { intent: p.intent, carry: p.carry || {}, ref } };
  }

  /* ---- desambiguisation d'intention ---- */
  if (p.kind === "disambiguate") {
    const clean = classification.analysis.clean;
    const opts = p.options || [];
    const byLabel = opts.find((o) => analyze(o.label).clean === clean || clean.includes(analyze(o.label).clean));
    const byIdx = clean.match(/^(?:le |la )?(\d)\b/);
    const chosen = byLabel || (byIdx ? opts[parseInt(byIdx[1], 10) - 1] : null);
    if (chosen) return { switchTo: chosen.id, carry: p.carry || {} };
    return { result: { reply: "Je n'ai pas compris votre choix.", quickReplies: opts.map((o) => o.label) }, pending: { ...p, ttl: PENDING_TTL } };
  }

  /* ---- slot attendu ---- */
  if (p.kind === "slots") {
    const slots = { ...p.slots };
    const answer = interpretAnswer(p.awaiting, text, entities);
    if (answer.error) {
      return { result: { reply: answer.error, quickReplies: p.awaiting === "type" ? ["appel", "email", "reunion", "note"] : undefined }, pending: { ...p, ttl: PENDING_TTL } };
    }
    if (p.awaiting === "email" && !EMAIL_RE.test(answer.value)) return { result: { reply: "Cette adresse email n'est pas valide." }, pending: { ...p, ttl: PENDING_TTL } };
    slots[p.awaiting] = answer.value;
    // Une reponse peut aussi apporter d'autres informations (ex: "Marie Curie marie@curie.fr")
    const action = WRITE_HANDLERS[intent.handler];
    action.fill(entities, slots, ctx);
    return advanceWrite(p.intent, slots, ctx);
  }

  return null;
}

/** Decremente la duree de vie d'un dialogue en attente (abandon automatique). */
function ageState(state) {
  if (!state.pending) return state;
  const ttl = (typeof state.pending.ttl === "number" ? state.pending.ttl : PENDING_TTL) - 1;
  if (ttl < 0) return { ...state, pending: null, expired: true };
  return { ...state, pending: { ...state.pending, ttl } };
}

module.exports = { startWrite, advanceWrite, handlePending, ageState, missingSlots, interpretAnswer, PENDING_TTL, CONFIRM_REPLIES };
