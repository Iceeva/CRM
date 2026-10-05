/**
 * test/chatbot.ai.test.js - IA optionnelle (OpenAI / Anthropic) avec appels reseau simules
 * Aucun appel reel : `fetch` est remplace par un faux serveur. Verifie :
 *  - sans cle, le moteur local repond seul
 *  - le fournisseur choisi est appele, avec masquage des emails et telephones
 *  - basculement vers l'autre fournisseur en cas d'echec, puis vers le moteur local
 *  - l'IA n'est jamais appelee pour une action du CRM ni pour une question claire
 */
const os = require("os");
const fs = require("fs");
const path = require("path");

const TMP = path.join(os.tmpdir(), `crm-ai-test-${process.pid}.json`);
process.env.JSON_STORE_PATH = TMP;
process.env.DATABASE_URL = "";
fs.rmSync(TMP, { force: true });

const test = require("node:test");
const assert = require("node:assert/strict");
const { env } = require("../src/config/env");

const NOW = new Date(2026, 9, 3, 10, 0);
const realFetch = global.fetch;
let calls = [];

function fakeFetch(behaviour) {
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    const handler = behaviour[url.includes("openai") || url.includes("chat/completions") ? "openai" : "anthropic"];
    if (!handler) throw new Error("fournisseur non prevu");
    return handler(body);
  };
}
const ok = (json) => ({ ok: true, status: 200, text: async () => JSON.stringify(json) });
const ko = (status) => ({ ok: false, status, statusText: "erreur", text: async () => JSON.stringify({ error: { message: "echec simule" } }) });

const openaiOk = () => ok({ model: "gpt-test", choices: [{ message: { content: "Reponse OpenAI." } }] });
const anthropicOk = () => ok({ model: "claude-test", content: [{ type: "text", text: "Reponse Anthropic." }] });

function configure(cfg) {
  Object.assign(env, { AI_PROVIDER: "none", AI_MODE: "fallback", AI_FAILOVER: true, OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" }, cfg);
}

const { respond } = require("../src/chatbot/engine");

test.beforeEach(() => {
  calls = [];
  configure({});
});
test.after(() => {
  global.fetch = realFetch;
  fs.rmSync(TMP, { force: true });
});

const ask = (text) => respond({ text, state: null, user: { nom: "T" }, now: NOW });

test("sans cle : moteur local uniquement, aucun appel reseau", async () => {
  fakeFetch({});
  configure({ AI_PROVIDER: "openai" }); // fournisseur choisi mais cle absente
  const r = await ask("asdfgh qwerty");
  assert.equal(r.engine, "local");
  assert.equal(r.intent, "unknown");
  assert.equal(calls.length, 0);
});

test("OpenAI : appele quand le moteur local ne comprend pas", async () => {
  fakeFetch({ openai: openaiOk });
  configure({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" });
  const r = await ask("asdfgh qwerty");
  assert.equal(r.engine, "openai");
  assert.equal(r.reply, "Reponse OpenAI.");
  assert.equal(calls.length, 1);
  assert.match(calls[0].headers.Authorization, /^Bearer sk-test$/);
  assert.equal(calls[0].body.messages[0].role, "system");
});

test("Anthropic : en-tetes et format de l'API Messages", async () => {
  fakeFetch({ anthropic: anthropicOk });
  configure({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "ak-test" });
  const r = await ask("asdfgh qwerty");
  assert.equal(r.engine, "anthropic");
  assert.equal(calls[0].headers["x-api-key"], "ak-test");
  assert.ok(calls[0].headers["anthropic-version"]);
  assert.equal(typeof calls[0].body.system, "string");
  assert.equal(calls[0].body.messages[0].role, "user");
});

test("vie privee : emails et telephones masques avant envoi", async () => {
  fakeFetch({ openai: openaiOk });
  configure({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" });
  await ask("zzzz yyyy marie@acme.com +33 6 12 34 56 78 qqqq");
  const sent = JSON.stringify(calls[0].body);
  assert.equal(sent.includes("marie@acme.com"), false);
  assert.equal(sent.includes("12 34 56"), false);
  assert.match(sent, /\[email\]/);
});

test("basculement : OpenAI en erreur -> Anthropic", async () => {
  fakeFetch({ openai: () => ko(500), anthropic: anthropicOk });
  configure({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test", ANTHROPIC_API_KEY: "ak-test", AI_FAILOVER: true });
  const r = await ask("asdfgh qwerty");
  assert.equal(r.engine, "anthropic");
  assert.equal(calls.length, 2);
});

test("sans basculement : l'echec ramene au moteur local", async () => {
  fakeFetch({ openai: () => ko(401), anthropic: anthropicOk });
  configure({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-bad", ANTHROPIC_API_KEY: "ak-test", AI_FAILOVER: false });
  const r = await ask("asdfgh qwerty");
  assert.equal(r.engine, "local");
  assert.equal(r.intent, "unknown");
  assert.equal(calls.length, 1);
});

test("les deux fournisseurs en panne : le chatbot repond quand meme", async () => {
  fakeFetch({ openai: () => ko(503), anthropic: () => ko(503) });
  configure({ AI_PROVIDER: "auto", OPENAI_API_KEY: "sk", ANTHROPIC_API_KEY: "ak" });
  const r = await ask("asdfgh qwerty");
  assert.equal(r.engine, "local");
  assert.ok(r.reply.length > 10);
});

test("l'IA n'est pas appelee pour une question claire du CRM", async () => {
  fakeFetch({ openai: openaiOk });
  configure({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" });
  const r = await ask("combien de clients actifs ?");
  assert.equal(r.engine, "local");
  assert.equal(calls.length, 0);
});

test("l'IA n'est jamais appelee pendant une confirmation d'action", async () => {
  fakeFetch({ openai: openaiOk });
  configure({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" });
  const a = await respond({ text: "nouveau client Paul Test email paul@test.io", state: null, user: { nom: "T" }, now: NOW });
  assert.equal(a.awaiting, "confirm");
  const b = await respond({ text: "blabla incomprehensible", state: a.state, user: { nom: "T" }, now: NOW });
  assert.equal(b.awaiting, "confirm");
  assert.equal(calls.length, 0);
});

test("question hors CRM : repondue par l'IA si configuree", async () => {
  fakeFetch({ openai: openaiOk });
  configure({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" });
  const r = await ask("raconte moi une blague");
  assert.equal(r.engine, "openai");
});

test("AI_MODE=off : jamais d'appel meme avec une cle", async () => {
  fakeFetch({ openai: openaiOk });
  configure({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test", AI_MODE: "off" });
  const r = await ask("asdfgh qwerty");
  assert.equal(r.engine, "local");
  assert.equal(calls.length, 0);
});
