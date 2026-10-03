/**
 * chatbot/llm/openai.js - Fournisseur OpenAI (API Chat Completions)
 * ----------------------------------------------------------------------------
 * OPTIONNEL. Active uniquement si OPENAI_API_KEY est renseignee et si
 * AI_PROVIDER vaut "openai" (ou "auto").
 * OPENAI_BASE_URL permet d'utiliser Azure OpenAI, OpenRouter, Ollama, LM Studio...
 * (toute API compatible Chat Completions).
 */
const { env } = require("../../config/env");
const { postJson } = require("./http");

module.exports = {
  id: "openai",
  label: "OpenAI",
  isConfigured: () => Boolean(env.OPENAI_API_KEY),
  model: () => env.OPENAI_MODEL,

  /**
   * @param {{ system: string, messages: {role: "user"|"assistant", content: string}[] }} input
   * @returns {Promise<{ text: string, usage?: object, model: string }>}
   */
  async complete({ system, messages }) {
    const json = await postJson(`${env.OPENAI_BASE_URL}/chat/completions`, {
      provider: "openai",
      timeoutMs: env.AI_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: {
        model: env.OPENAI_MODEL,
        temperature: env.AI_TEMPERATURE,
        // Les modeles recents utilisent max_completion_tokens ; les API compatibles historiques max_tokens.
        ...(/^(o\d|gpt-5)/.test(env.OPENAI_MODEL) ? { max_completion_tokens: env.AI_MAX_TOKENS } : { max_tokens: env.AI_MAX_TOKENS }),
        messages: [{ role: "system", content: system }, ...messages],
      },
    });
    const text = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (!text) throw new Error("openai : reponse vide");
    return { text: text.trim(), usage: json.usage, model: json.model || env.OPENAI_MODEL };
  },
};
