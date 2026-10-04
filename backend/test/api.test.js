/**
 * test/api.test.js - Tests de l'API HTTP (Express + JWT + CRUD + chatbot)
 * Necessite `npm install` (express, bcryptjs, jsonwebtoken...). Si les
 * dependances sont absentes, la suite est ignoree sans echec.
 */
const os = require("os");
const fs = require("fs");
const path = require("path");

const TMP = path.join(os.tmpdir(), `crm-api-test-${process.pid}.json`);
process.env.JSON_STORE_PATH = TMP;
process.env.DATABASE_URL = "";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
process.env.NODE_ENV = "test";
process.env.AI_PROVIDER = "none";
process.env.BCRYPT_ROUNDS = "4";
fs.rmSync(TMP, { force: true });

const test = require("node:test");
const assert = require("node:assert/strict");

let app;
let skip = false;
try {
  app = require("../src/app");
} catch (err) {
  if (err.code === "MODULE_NOT_FOUND") skip = `dependances absentes (${err.message.split("\n")[0]})`;
  else throw err;
}

let server;
let base;
let token;

test.before(async () => {
  if (skip) return;
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(() => {
  if (server) server.close();
  fs.rmSync(TMP, { force: true });
});

const call = async (method, url, body, auth = true) => {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

test("health check public", { skip }, async () => {
  const r = await call("GET", "/health", null, false);
  assert.equal(r.status, 200);
  assert.equal(r.body.storageMode, "json");
});

test("routes protegees sans jeton : 401", { skip }, async () => {
  assert.equal((await call("GET", "/clients", null, false)).status, 401);
  assert.equal((await call("POST", "/chatbot/message", { message: "bonjour" }, false)).status, 401);
});

test("inscription : role force a user, validation, doublon", { skip }, async () => {
  const bad = await call("POST", "/auth/register", { nom: "X", email: "pas-un-email", password: "123456" }, false);
  assert.equal(bad.status, 400);
  const ok = await call("POST", "/auth/register", { nom: "Test User", email: "Test@Example.com", password: "secret123", role: "admin" }, false);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.role, "user"); // le role admin envoye est ignore
  assert.equal(ok.body.user.password, undefined);
  assert.equal(ok.body.user.email, "test@example.com");
  token = ok.body.token;
  const dup = await call("POST", "/auth/register", { nom: "Test User", email: "test@example.com", password: "secret123" }, false);
  assert.equal(dup.status, 409);
});

test("connexion : mauvais mot de passe = 401", { skip }, async () => {
  const r = await call("POST", "/auth/login", { email: "test@example.com", password: "mauvais" }, false);
  assert.equal(r.status, 401);
  const ok = await call("POST", "/auth/login", { email: "test@example.com", password: "secret123" }, false);
  assert.equal(ok.status, 200);
});

test("CRUD clients + pagination + recherche", { skip }, async () => {
  const created = await call("POST", "/clients", { nom: "Client API", email: "api@client.io" });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal((await call("GET", `/clients/${id}`)).body.nom, "Client API");
  assert.equal((await call("PUT", `/clients/${id}`, { entreprise: "ACME API" })).body.entreprise, "ACME API");
  const list = await call("GET", "/clients?search=acme%20api&limit=5");
  assert.equal(list.body.total, 1);
  assert.equal((await call("POST", "/clients", { nom: "", email: "x" })).status, 400);
  assert.equal((await call("DELETE", `/clients/${id}`)).status, 200);
  assert.equal((await call("GET", `/clients/${id}`)).status, 404);
});

test("interaction sans client ni prospect : 400 ; reference inconnue : 400", { skip }, async () => {
  assert.equal((await call("POST", "/interactions", { type: "note", sujet: "x" })).status, 400);
  assert.equal((await call("POST", "/interactions", { type: "note", sujet: "x", client_id: "inconnu" })).status, 400);
});

test("opportunites : montant numerique et statut valide", { skip }, async () => {
  const r = await call("POST", "/opportunities", { titre: "Deal API", montant: "2500.5", statut: "negociation" });
  assert.equal(r.status, 201);
  assert.equal(r.body.montant, 2500.5);
  assert.equal((await call("POST", "/opportunities", { titre: "Mauvais", statut: "inconnu" })).status, 400);
});

test("tableau de bord", { skip }, async () => {
  const r = await call("GET", "/dashboard/stats");
  assert.equal(r.status, 200);
  assert.ok(r.body.totalClients >= 1);
  assert.equal(typeof r.body.pipelineValue, "number");
});

test("chatbot : message, etat de dialogue et historique", { skip }, async () => {
  const a = await call("POST", "/chatbot/message", { message: "combien de clients ?" });
  assert.equal(a.status, 200);
  assert.equal(a.body.intent, "count_records");
  assert.ok(a.body.sessionId);
  assert.equal(a.body._debug, undefined);
  const h = await call("GET", `/chatbot/history?sessionId=${a.body.sessionId}`);
  assert.equal(h.body.messages.length, 2);
  assert.equal((await call("POST", "/chatbot/message", { message: "" })).status, 400);
  const s = await call("GET", "/chatbot/status");
  assert.equal(s.body.ai.enabled, false);
  assert.equal(JSON.stringify(s.body).includes("sk-"), false);
});

test("route inconnue : 404 JSON", { skip }, async () => {
  const r = await call("GET", "/nimporte-quoi");
  assert.equal(r.status, 404);
  assert.ok(r.body.error);
});
