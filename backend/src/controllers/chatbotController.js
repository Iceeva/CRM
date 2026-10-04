/**
 * controllers/chatbotController.js - API du chatbot assistant
 */
const { env } = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const service = require("../chatbot/service");
const llm = require("../chatbot/llm");
const { classify } = require("../chatbot/engine/classifier");
const { INTENTS } = require("../chatbot/intents");

/** POST /api/chatbot/message  { message, sessionId?, state? } */
exports.message = asyncHandler(async (req, res) => {
  if (!env.CHATBOT_ENABLED) throw new HttpError(503, "Le chatbot est desactive");
  const { message, sessionId, state } = req.body;
  const out = await service.handleMessage({ userId: req.userId, text: message, sessionId, state });
  // Le detail de la classification n'est jamais expose en production
  if (!(env.CHATBOT_DEBUG && req.query.debug === "1")) delete out._debug;
  else out._debug = { ...out._debug, classification: { ...out._debug.classification, candidates: out._debug.classification.candidates.map(({ id, score, lex, kw, pat, adjust, notes, prob }) => ({ id, score, lex, kw, pat, adjust, notes, prob })) } };
  res.json(out);
});

/** GET /api/chatbot/status - configuration visible par le frontend (jamais de cle) */
exports.status = asyncHandler(async (req, res) => {
  res.json({
    enabled: env.CHATBOT_ENABLED,
    intents: INTENTS.length,
    minConfidence: env.CHATBOT_MIN_CONFIDENCE,
    persistHistory: env.CHATBOT_PERSIST_HISTORY,
    ai: llm.status(),
  });
});

/** GET /api/chatbot/history?sessionId= */
exports.history = asyncHandler(async (req, res) => {
  const messages = await service.getSessionMessages(req.userId, req.query.sessionId);
  res.json({ messages });
});

/** DELETE /api/chatbot/history - efface toutes les conversations de l'utilisateur */
exports.clearHistory = asyncHandler(async (req, res) => {
  const removed = await service.clearHistory(req.userId);
  res.json({ message: "Historique supprime", removed });
});

/** POST /api/chatbot/analyze  { message } - debug du moteur (CHATBOT_DEBUG=true uniquement) */
exports.analyze = asyncHandler(async (req, res) => {
  if (!env.CHATBOT_DEBUG) throw new HttpError(404, "Route introuvable");
  const r = classify(req.body.message);
  res.json({
    intent: r.intent,
    confidence: r.confidence,
    margin: r.margin,
    ambiguity: r.ambiguity ? { question: r.ambiguity.group.question, options: r.ambiguity.options } : null,
    entities: (({ _sources, ...e }) => ({ ...e, sources: _sources }))(r.entities),
    analysis: r.analysis,
    candidates: r.candidates.map(({ id, score, lex, kw, pat, adjust, notes, patterns, prob }) => ({ id, score, lex, kw, pat, adjust, notes, patterns, prob })),
  });
});
