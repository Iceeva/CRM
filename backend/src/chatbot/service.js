/**
 * chatbot/service.js - Couche service du chatbot (historique + moteur)
 * ----------------------------------------------------------------------------
 * - charge l'historique recent de la session (utile au contexte de l'IA)
 * - appelle le moteur d'intentions
 * - enregistre la conversation (table chat_messages ou JSON) si CHATBOT_PERSIST_HISTORY
 *   Une erreur d'enregistrement n'interrompt JAMAIS la reponse.
 */
const { env } = require("../config/env");
const storage = require("../services/storageService");
const { respond } = require("./engine");
const llm = require("./llm");

const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;

function cleanSessionId(id) {
  return typeof id === "string" && SESSION_RE.test(id) ? id : null;
}

/** Messages recents d'une session, du plus ancien au plus recent. */
async function loadHistory(userId, sessionId, limit = 8) {
  if (!env.CHATBOT_PERSIST_HISTORY || !sessionId) return [];
  try {
    const { data } = await storage.findAll("chat_messages", { filters: { user_id: userId, session_id: sessionId }, limit });
    return data.reverse().map((m) => ({ role: m.role, content: m.content }));
  } catch (_) {
    return [];
  }
}

async function saveTurn({ userId, sessionId, userText, reply, intent, confidence, engine }) {
  if (!env.CHATBOT_PERSIST_HISTORY) return;
  try {
    const now = Date.now();
    await storage.create("chat_messages", { user_id: userId, session_id: sessionId, role: "user", content: userText.slice(0, 2000), intent, confidence, engine: "local", created_at: new Date(now - 1).toISOString() });
    await storage.create("chat_messages", { user_id: userId, session_id: sessionId, role: "assistant", content: reply.slice(0, 4000), intent, confidence, engine, created_at: new Date(now).toISOString() });
  } catch (err) {
    console.warn("[chatbot] historique non enregistre :", err.message);
  }
}

/**
 * @param {{ userId: string, text: string, sessionId?: string, state?: object }} input
 */
async function handleMessage({ userId, text, sessionId, state }) {
  const sid = cleanSessionId(sessionId) || `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await storage.findById("users", userId).catch(() => null);
  const history = llm.isEnabled() ? await loadHistory(userId, sid) : [];

  const out = await respond({ text, state, user, history });
  await saveTurn({ userId, sessionId: sid, userText: text, reply: out.reply, intent: out.intent, confidence: out.confidence, engine: out.engine });
  return { ...out, sessionId: sid };
}

/** Historique complet d'une session (pour recharger la conversation). */
async function getSessionMessages(userId, sessionId, limit = 100) {
  const sid = cleanSessionId(sessionId);
  if (!sid) return [];
  const { data } = await storage.findAll("chat_messages", { filters: { user_id: userId, session_id: sid }, limit });
  return data.reverse().map((m) => ({ id: m.id, role: m.role, content: m.content, intent: m.intent, engine: m.engine, created_at: m.created_at }));
}

/** Supprime toutes les conversations d'un utilisateur. */
async function clearHistory(userId) {
  let removed = 0;
  // Boucle par lots : evite de charger un historique illimite
  for (let i = 0; i < 20; i++) {
    const { data } = await storage.findAll("chat_messages", { filters: { user_id: userId }, limit: 200 });
    if (!data.length) break;
    for (const m of data) {
      await storage.remove("chat_messages", m.id);
      removed++;
    }
  }
  return removed;
}

module.exports = { handleMessage, getSessionMessages, clearHistory, cleanSessionId };
