/**
 * test/chatbot.dialog.test.js - Conversations completes de bout en bout
 * (moteur + dialogue + stockage JSON temporaire). Aucun reseau, aucune cle IA.
 */
const os = require("os");
const fs = require("fs");
const path = require("path");

// Le stockage doit etre configure AVANT le chargement des modules
const TMP = path.join(os.tmpdir(), `crm-test-${process.pid}.json`);
process.env.JSON_STORE_PATH = TMP;
process.env.DATABASE_URL = "";
process.env.AI_PROVIDER = "none";
fs.rmSync(TMP, { force: true });

const test = require("node:test");
const assert = require("node:assert/strict");
const { respond } = require("../src/chatbot/engine");
const storage = require("../src/services/storageService");

const NOW = new Date(2026, 9, 3, 10, 0);

/** Petit "client" de test : conserve l'etat entre les messages comme le ferait le frontend. */
function chat() {
  let state = null;
  return async (text) => {
    const r = await respond({ text, state, user: { nom: "Test" }, now: NOW });
    state = r.state;
    return r;
  };
}

test.after(() => fs.rmSync(TMP, { force: true }));

test("lecture : comptage puis relance contextuelle", async () => {
  const say = chat();
  const a = await say("combien de clients actifs ?");
  assert.equal(a.intent, "count_records");
  assert.match(a.reply, /clients? actifs?/);
  const b = await say("et les prospects ?");
  assert.equal(b.intent, "count_records");
  assert.match(b.reply, /prospects?/);
});

test("lecture : pronom apres une recherche (son telephone)", async () => {
  const say = chat();
  await say("quel est l'email de Marie Dupond"); // faute de frappe volontaire
  const r = await say("et son telephone ?");
  assert.equal(r.intent, "get_contact_info");
  assert.match(r.reply, /\+33 6 12 34 56 78/);
});

test("lecture : periode relative (CA du mois dernier)", async () => {
  const say = chat();
  const r = await say("chiffre d'affaires du mois dernier");
  assert.equal(r.intent, "revenue_total");
  assert.match(r.reply, /35 500 EUR/);
});

test("ecriture : creation d'un client avec slots, confirmation et verification en base", async () => {
  const say = chat();
  const q1 = await say("ajoute un client");
  assert.equal(q1.awaiting, "slots");
  const q2 = await say("Aicha Konate");
  assert.match(q2.reply, /email/i);
  const q3 = await say("aicha@konate.bj");
  assert.equal(q3.awaiting, "confirm");
  const ok = await say("oui");
  assert.match(ok.reply, /cree avec succes/);
  const found = await storage.findAll("clients", { filters: { email: "aicha@konate.bj" } });
  assert.equal(found.total, 1);
});

test("ecriture : refus de confirmation = aucune modification", async () => {
  const say = chat();
  const before = await storage.count("clients");
  await say("nouveau client Paul Test email paul@test.io");
  const r = await say("non");
  assert.match(r.reply, /rien n'a ete modifie/);
  assert.equal(await storage.count("clients"), before);
});

test("ecriture : email invalide redemande", async () => {
  const say = chat();
  await say("ajoute un prospect");
  await say("Zoe Martin");
  const bad = await say("pas un email");
  assert.match(bad.reply, /email/i);
  assert.equal(bad.awaiting, "slots");
});

test("ecriture : phrase complete en un seul message", async () => {
  const say = chat();
  const r = await say('cree une opportunite "Refonte site web" de 12 000 euros');
  assert.equal(r.intent, "create_opportunity");
  assert.equal(r.awaiting, "confirm");
  assert.match(r.reply, /12 000 EUR/);
  await say("oui");
  const all = await storage.findAll("opportunities", { search: "Refonte site web" });
  assert.equal(all.total, 1);
  assert.equal(all.data[0].montant, 12000);
});

test("ecriture : interaction avec reference floue et date relative", async () => {
  const say = chat();
  const r = await say("j'ai appele Nadia Benali hier");
  assert.equal(r.intent, "log_interaction");
  assert.match(r.reply, /02\/10\/2026/);
  await say("oui");
  const list = await storage.findAll("interactions", { search: "Nadia" });
  assert.ok(list.total >= 1);
});

test("ecriture : conversion d'un prospect", async () => {
  const say = chat();
  await say("convertis Camille Moreau en client");
  const r = await say("oui");
  assert.match(r.reply, /maintenant client/);
  const p = await storage.findAll("prospects", { search: "Camille" });
  assert.equal(p.data[0].statut, "converti");
  const again = await say("convertis Camille Moreau en client");
  assert.match(again.reply, /deja converti/);
});

test("ecriture : suppression avec avertissement, puis annulation", async () => {
  const say = chat();
  const warn = await say("supprime le client Lucas Bernard");
  assert.match(warn.reply, /irreversible/);
  assert.match(warn.reply, /detachee/);
  await say("non");
  assert.equal((await storage.findAll("clients", { search: "Lucas Bernard" })).total, 1);
});

test("ecriture : statut invalide pour la ressource", async () => {
  const say = chat();
  const r = await say("passe le client Sophie Laurent en gagnee");
  assert.match(r.reply, /ne s'applique pas/);
});

test("ambiguite : question de precision puis poursuite", async () => {
  const say = chat();
  const q = await say("ajoute Marie Curie");
  assert.equal(q.awaiting, "disambiguate");
  assert.ok(q.quickReplies.length >= 2);
  const next = await say("Un prospect");
  assert.equal(next.intent, "create_prospect");
});

test("choix entre plusieurs candidats par numero", async () => {
  const say = chat();
  const q = await say("email de ACME");
  assert.equal(q.awaiting, "choose");
  const r = await say("1");
  assert.equal(r.awaiting, null);
});

test("changement de sujet pendant un dialogue", async () => {
  const say = chat();
  await say("ajoute un client");
  const r = await say("combien de prospects nouveaux ?");
  assert.equal(r.intent, "count_records");
  assert.equal(r.awaiting, null);
});

test("hors sujet et incomprehension : jamais d'action sur les donnees", async () => {
  const say = chat();
  const a = await say("quelle est la capitale de la France ?");
  assert.equal(a.intent, "off_topic");
  const b = await say("asdfgh qwerty");
  assert.equal(b.intent, "unknown");
  const c = await say("oui");
  assert.match(c.reply, /rien a confirmer/);
});

test("etat client falsifie : assaini sans erreur", async () => {
  const r = await respond({
    text: "bonjour",
    state: { pending: { kind: "confirm", intent: "delete_record", slots: { cible: { type: "clients", id: 123 } } }, lastIntent: "<script>", turns: "abc", lastRecord: { type: "x", id: "y" } },
    user: { nom: "T" },
    now: NOW,
  });
  assert.equal(r.intent, "greeting");
  assert.equal(r.state.pending, null);
});
