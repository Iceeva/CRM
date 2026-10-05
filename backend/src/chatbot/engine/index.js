/**
 * chatbot/engine/index.js - Orchestrateur du chatbot
 * ----------------------------------------------------------------------------
 * Pipeline d'une requete :
 *
 *   1. assainir l'etat envoye par le client, vieillir le dialogue en attente
 *   2. classer le message (NLP + intentions + entites + score de confiance)
 *   3. dialogue en cours ? (slot, confirmation, choix) -> dialog.handlePending
 *   4. relance contextuelle ("et les prospects ?", "et son telephone ?")
 *   5. ambiguite entre deux intentions proches -> question de precision
 *   6. confiance trop faible -> IA optionnelle (OpenAI / Anthropic) sinon aide locale
 *   7. execution du handler (lecture) ou de l'action (ecriture, avec confirmation)
 *   8. mode "assist" : reformulation optionnelle par l'IA
 *   9. construction de la reponse et du nouvel etat
 *
 * `respond()` est pure vis-a-vis du serveur : tout l'etat voyage dans `state`.
 */
const { env } = require("../../config/env");
const { classify } = require("./classifier");
const { sanitizeState, newState } = require("./state");
const dialog = require("./dialog");
const { INTENTS, BY_ID } = require("../intents");
const { READ_HANDLERS } = require("../handlers");
const { extractEntities } = require("../nlp/entities");
const { MODEL } = require("./classifier");
const llm = require("../llm");
const storage = require("../../services/storageService");
const { computeStats } = require("../../controllers/dashboardController");
const F = require("./format");

const FOLLOWABLE = new Set(["count_records", "list_records", "revenue_total", "get_contact_info", "record_details", "interaction_history", "recent_activity", "top_opportunities", "closing_soon", "find_record"]);
const SOCIAL = new Set(["greeting", "goodbye", "thanks", "how_are_you", "bot_identity", "help", "off_topic", "affirm", "deny"]);
const ENTITY_KEYS = ["entityType", "statut", "statutScope", "field", "interactionType", "period", "count", "amount", "amountConstraint", "sort", "names", "company", "emails", "date", "title", "residual", "pronoun"];

const SUGGESTIONS = ["Resume de mon activite", "Combien de clients actifs ?", "Qui dois-je relancer ?", "Que sais-tu faire ?"];

/* ------------------------------------------------------------------ */

const hasContextEntity = (e) => ["entityType", "statut", "period", "field", "count", "amountConstraint", "pronoun", "names", "interactionType"].some((k) => e[k] !== undefined);

/** Fusionne les entites d'une relance avec celles du tour precedent. */
function mergeFollowUp(entities, state) {
  const prev = state.lastEntities || {};
  const merged = { ...entities };
  if (!merged.entityType && prev.entityType && !merged.field && !merged.names && !merged.pronoun) merged.entityType = prev.entityType;
  if (!merged.field && prev.field && (merged.pronoun || merged.names)) merged.field = prev.field;
  // Le statut precedent n'a de sens que pour la meme ressource ("et les prospects ?" l'abandonne)
  if (!merged.statut && prev.statut && merged.entityType === prev.entityType && !merged.period) merged.statut = prev.statut;
  return merged;
}

/** Entites utiles a conserver pendant une question de precision. */
function carryOf(e) {
  const c = {};
  for (const k of ["field", "interactionType", "entityType", "statut", "company", "title"]) if (typeof e[k] === "string") c[k] = e[k];
  for (const k of ["names", "emails", "phones"]) if (Array.isArray(e[k])) c[k] = e[k].slice(0, 3);
  if (typeof e.amount === "number") c.amount = e.amount;
  if (typeof e.date === "string") c.date = e.date;
  return c;
}

/** Contexte agrege transmis a l'IA (jamais de donnees nominatives, sauf AI_SHARE_CRM_DATA). */
async function aiContext() {
  try {
    const s = await computeStats();
    return [
      `Clients : ${s.totalClients} (actifs : ${s.clientsByStatut.actif || 0})`,
      `Prospects : ${s.totalProspects} (nouveaux : ${s.prospectsNouveaux}, contactes : ${s.prospectsContactes}, convertis : ${s.prospectsConvertis})`,
      `Opportunites : ${s.totalOpportunities} (gagnees : ${s.oppGagnees}, perdues : ${s.oppPerdues}, ouvertes : ${s.oppOuvertes})`,
      `Chiffre d'affaires gagne : ${F.money(s.totalRevenue)} - pipeline ouvert : ${F.money(s.pipelineValue)}`,
      `Taux de conversion des prospects : ${s.conversionRate} %`,
    ].join("\n");
  } catch (_) {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Execution d'une intention                                          */
/* ------------------------------------------------------------------ */

async function runIntent(intentId, entities, ctx) {
  const intent = BY_ID[intentId];

  if (intent.confirm) {
    const { result, pending } = await dialog.startWrite(intentId, entities, ctx);
    return { result, pending };
  }

  const handler = READ_HANDLERS[intent.handler];
  const result = await handler({ ...ctx, entities });

  // Reference ambigue : on attend le choix de l'utilisateur
  if (result.choose) {
    return {
      result: { ...result, choose: undefined },
      pending: { kind: "choose", intent: intentId, slots: {}, options: result.choose, carry: carryOf(entities), ttl: dialog.PENDING_TTL },
    };
  }
  return { result, pending: null };
}

/** Message "je n'ai pas compris" avec suggestion de la meilleure intention. */
function notUnderstood(classification) {
  const top = classification.candidates[0];
  const lines = ["Je n'ai pas bien compris votre demande."];
  const quick = [];
  if (top && classification.confidence >= 0.3 && !SOCIAL.has(top.id)) {
    lines.push(`Voulez-vous dire : "${BY_ID[top.id].description.charAt(0).toLowerCase() + BY_ID[top.id].description.slice(1)}" ?`);
    quick.push(BY_ID[top.id].examples[0].charAt(0).toUpperCase() + BY_ID[top.id].examples[0].slice(1));
  }
  lines.push("Essayez par exemple : \"combien de clients actifs ?\", \"fiche de Marie Dupont\" ou \"chiffre d'affaires du mois dernier\".");
  return { reply: lines.join("\n"), quickReplies: [...quick, ...SUGGESTIONS].slice(0, 5) };
}

/* ------------------------------------------------------------------ */
/*  Point d'entree                                                     */
/* ------------------------------------------------------------------ */

/**
 * @param {{ text: string, state?: object, user?: object, history?: {role:string,content:string}[], now?: Date }} input
 * @returns {Promise<object>} reponse complete (voir README, section "API du chatbot")
 */
async function respond({ text, state: rawState, user, history = [], now = new Date() }) {
  const started = Date.now();
  let state = dialog.ageState(sanitizeState(rawState));
  const expired = Boolean(state.expired);
  delete state.expired;

  const ctx = { text, state, user, now, aiProvider: llm.primaryProvider() };

  // 1. Classification (avec un leger biais de contexte : la relance favorise l'intention precedente)
  let classification = classify(text, { now });
  const clean = classification.analysis.clean;
  const startsWithEt = /^(et|et pour|et aussi|aussi|pareil|meme chose|et si)\b/.test(clean);

  let engine = "local";
  let out = null; // { result, pending }
  let usedIntent = classification.intent;
  let entities = classification.entities;

  // 2. Dialogue en cours
  if (state.pending) {
    const handled = await dialog.handlePending(text, state, ctx, classification);
    if (handled && handled.rerun) {
      const r = handled.rerun;
      // On retire les termes de recherche d'origine : l'enregistrement choisi est deja identifie
      const { names, company, title, emails, phones, ...kept } = r.carry || {};
      const ents = { ...kept, pronoun: true };
      const st = { ...state, lastRecord: r.ref };
      out = await runIntent(r.intent, ents, { ...ctx, state: st });
      usedIntent = r.intent;
      entities = ents;
    } else if (handled && handled.switchTo) {
      const merged = { ...entities };
      if (handled.carry) for (const [k, v] of Object.entries(handled.carry)) if (merged[k] === undefined) merged[k] = v;
      out = await runIntent(handled.switchTo, merged, ctx);
      usedIntent = handled.switchTo;
      entities = merged;
    } else if (handled && handled.result) {
      out = { result: handled.result, pending: handled.pending };
      usedIntent = state.pending.intent;
    }
  }

  // 3. Relance contextuelle
  if (!out) {
    const followUp =
      state.lastIntent && FOLLOWABLE.has(state.lastIntent) && hasContextEntity(entities) &&
      (startsWithEt || (classification.confidence < 0.6 && clean.split(" ").length <= 7) || (entities.pronoun && classification.candidates[0].score < 0.6));
    if (followUp) {
      const merged = mergeFollowUp(entities, state);
      out = await runIntent(state.lastIntent, merged, ctx);
      usedIntent = state.lastIntent;
      entities = merged;
      classification = { ...classification, intent: state.lastIntent, confidence: Math.max(classification.confidence, 0.7), followUp: true };
    }
  }

  // 4. Ambiguite entre deux intentions proches
  if (!out && classification.ambiguity && classification.confidence < 0.9) {
    const { group, options } = classification.ambiguity;
    const opts = (options.length > 1 ? options : group.ids).map((id) => ({ id, label: group.labels[id] }));
    out = {
      result: { reply: `${group.question}`, quickReplies: opts.map((o) => o.label) },
      pending: { kind: "disambiguate", intent: opts[0].id, slots: {}, options: opts, carry: carryOf(entities), ttl: dialog.PENDING_TTL },
    };
  }

  // 4b. "oui" / "non" sans question en attente
  if (!out && !state.pending && (entities.yes || entities.no) && clean.split(" ").length <= 3) {
    out = {
      result: { reply: entities.no ? "D'accord. Que souhaitez-vous faire d'autre ?" : "Il n'y a rien a confirmer pour le moment. Que souhaitez-vous faire ?", quickReplies: SUGGESTIONS.slice(0, 3) },
      pending: null,
    };
    usedIntent = entities.no ? "deny" : "affirm";
  }

  // 5. Confiance trop faible, ou question hors CRM quand une IA est configuree
  //    -> IA optionnelle ; sinon message d'aide (ou reponse locale "hors perimetre")
  const offTopicWithAi = classification.intent === "off_topic" && llm.isEnabled() && env.AI_MODE !== "off";
  if (!out && (classification.confidence < env.CHATBOT_MIN_CONFIDENCE || offTopicWithAi)) {
    const ai = llm.isEnabled() && env.AI_MODE !== "off"
      ? await llm.ask({ history, message: text, context: await aiContext(), purpose: "answer" })
      : null;
    if (ai) {
      engine = ai.provider;
      out = { result: { reply: ai.text, quickReplies: SUGGESTIONS.slice(0, 3) }, pending: null };
    } else if (!offTopicWithAi) {
      out = { result: notUnderstood(classification), pending: null };
      usedIntent = "unknown";
    }
    // IA indisponible sur une question hors sujet : le handler local "off_topic" repond
  }

  // 6. Execution normale
  if (!out) out = await runIntent(classification.intent, entities, ctx);

  const { result, pending } = out;

  // 7. Mode "assist" : reformulation par l'IA (uniquement si le partage de donnees est autorise)
  let finalReply = result.reply;
  if (engine === "local" && env.AI_MODE === "assist" && llm.isEnabled() && !pending && usedIntent !== "unknown") {
    const safe = env.AI_SHARE_CRM_DATA || SOCIAL.has(usedIntent);
    if (safe) {
      const ai = await llm.ask({
        history,
        message: `Reformule la reponse suivante de maniere naturelle et concise, sans modifier aucun chiffre, nom ou date.\nQuestion de l'utilisateur : ${text}\nReponse a reformuler :\n${result.reply}`,
        purpose: "rewrite",
      });
      if (ai) { finalReply = ai.text; engine = ai.provider; }
    }
  }
  if (expired) finalReply = `(Ma question precedente a expire.)\n${finalReply}`;

  // 8. Nouvel etat
  const nextState = {
    turns: state.turns + 1,
    lastIntent: SOCIAL.has(usedIntent) || usedIntent === "unknown" ? state.lastIntent : usedIntent,
    lastResource: result.resource || (entities.entityType && !SOCIAL.has(usedIntent) ? entities.entityType : state.lastResource),
    lastRecord: result.record === undefined ? state.lastRecord : result.record,
    lastEntities: {
      ...(entities.entityType ? { entityType: entities.entityType } : {}),
      ...(entities.statut ? { statut: entities.statut } : {}),
      ...(entities.field ? { field: entities.field } : {}),
    },
    pending: pending || null,
  };

  return {
    reply: finalReply,
    items: result.items || [],
    actions: result.actions || [],
    quickReplies: (result.quickReplies || []).slice(0, 5),
    intent: usedIntent,
    confidence: Number(classification.confidence.toFixed(3)),
    engine,
    awaiting: pending ? pending.kind : null,
    state: nextState,
    latencyMs: Date.now() - started,
    _debug: { classification, entities },
  };
}

module.exports = { respond, newState, MODEL, INTENTS };
