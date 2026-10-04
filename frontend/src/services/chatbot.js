/**
 * services/chatbot.js - Appels API du chatbot assistant
 */
import api from "./api";

/** Envoie un message. `state` est l'etat de dialogue renvoye par la reponse precedente. */
export async function sendMessage({ message, sessionId, state }) {
  const { data } = await api.post("/chatbot/message", { message, sessionId, state });
  return data;
}

/** Configuration publique du chatbot (moteur local, IA optionnelle activee ou non). */
export async function getChatbotStatus() {
  const { data } = await api.get("/chatbot/status");
  return data;
}

/** Efface l'historique des conversations de l'utilisateur. */
export async function clearChatHistory() {
  const { data } = await api.delete("/chatbot/history");
  return data;
}
