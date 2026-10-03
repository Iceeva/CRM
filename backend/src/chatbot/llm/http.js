/**
 * chatbot/llm/http.js - Appel HTTP JSON avec delai maximal (fetch natif, Node 18+)
 * Aucun SDK externe : le bundle serverless reste leger et les deux fournisseurs
 * partagent exactement le meme mecanisme (timeout, erreurs, masquage des cles).
 */
class LlmError extends Error {
  constructor(message, { status, provider, retryable = false } = {}) {
    super(message);
    this.name = "LlmError";
    this.status = status;
    this.provider = provider;
    this.retryable = retryable;
  }
}

/**
 * @param {string} url
 * @param {{ headers: object, body: object, timeoutMs: number, provider: string }} opts
 * @returns {Promise<object>} JSON de la reponse
 */
async function postJson(url, { headers, body, timeoutMs, provider }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) { /* reponse non JSON */ }
    if (!res.ok) {
      const detail = (json && (json.error && (json.error.message || json.error))) || text.slice(0, 200) || res.statusText;
      throw new LlmError(`${provider} a repondu ${res.status} : ${typeof detail === "string" ? detail : JSON.stringify(detail)}`, {
        status: res.status,
        provider,
        retryable: res.status === 429 || res.status >= 500,
      });
    }
    return json;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err.name === "AbortError") throw new LlmError(`${provider} : delai de ${timeoutMs} ms depasse`, { provider, retryable: true });
    throw new LlmError(`${provider} : ${err.message}`, { provider, retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { postJson, LlmError };
