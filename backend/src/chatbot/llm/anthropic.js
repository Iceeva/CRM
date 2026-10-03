/**
 * chatbot/llm/anthropic.js - Fournisseur Anthropic (API Messages)
 * ----------------------------------------------------------------------------
 * OPTIONNEL. Active uniquement si ANTHROPIC_API_KEY est renseignee et si
 * AI_PROVIDER vaut "anthropic" (ou "auto").
 * Le modele se change avec ANTHROPIC_MODEL (voir docs.anthropic.com pour la liste).
 */
const { env } = require("../../config/env");
const { postJson } = require("./http");

module.exports = {
  id: "anthropic",
  label: "Anthropic",
  isConfigured: () => Boolean(env.ANTHROPIC_API_KEY),
  model: () => env.ANTHROPIC_MODEL,

  /**
   * @param {{ system: string, messages: {role: "user"|"assistant", content: string}[] }} input
   * @returns {Promise<{ text: string, usage?: object, model: string }>}
   */
  async complete({ system, messages }) {
    const json = await postJson(`${env.ANTHROPIC_BASE_URL}/v1/messages`, {
      provider: "anthropic",
      timeoutMs: env.AI_TIMEOUT_MS,
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": env.ANTHROPIC_VERSION },
      body: {
        model: env.ANTHROPIC_MODEL,
        max_tokens: env.AI_MAX_TOKENS,
        temperature: env.AI_TEMPERATURE,
        system,
        // L'API Messages exige que la premiere intervention soit celle de l'utilisateur
        messages: messages[0] && messages[0].role === "assistant" ? messages.slice(1) : messages,
      },
    });
    const text = json && Array.isArray(json.content) ? json.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() : "";
    if (!text) throw new Error("anthropic : reponse vide");
    return { text, usage: json.usage, model: json.model || env.ANTHROPIC_MODEL };
  },
};
