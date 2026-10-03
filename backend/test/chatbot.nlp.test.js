/**
 * test/chatbot.nlp.test.js - Tests unitaires de la couche NLP
 * (normalisation, racines, similarite, dates, montants, entites)
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { normalize } = require("../src/chatbot/nlp/normalize");
const { stem } = require("../src/chatbot/nlp/stemmer");
const { damerauLevenshtein, fuzzyTokenScore, jaroWinkler } = require("../src/chatbot/nlp/similarity");
const { extractDate, extractPeriod } = require("../src/chatbot/nlp/dates");
const { extractAmounts, extractAmountConstraint } = require("../src/chatbot/nlp/numbers");
const { extractEntities } = require("../src/chatbot/nlp/entities");

const NOW = new Date(2026, 9, 3); // samedi 3 octobre 2026

test("normalisation : accents, apostrophes, argot", () => {
  assert.equal(normalize("Réunion d’équipe").clean, "reunion d equipe");
  assert.equal(normalize("bjr stp").clean, "bonjour s il te plait");
  assert.equal(normalize("Combien d'opps ?").clean, "combien d opportunites");
  assert.equal(normalize("rendez-vous").clean, "rendez vous");
});

test("racinisation : pluriels et conjugaisons proches", () => {
  assert.equal(stem("clients"), stem("client"));
  assert.equal(stem("ajouter"), stem("ajoute"));
  assert.equal(stem("opportunites"), stem("opportunite"));
  assert.notEqual(stem("prospect"), stem("client"));
});

test("similarite : fautes de frappe et transpositions", () => {
  assert.equal(damerauLevenshtein("cleint", "client"), 1);
  assert.ok(fuzzyTokenScore("cleints", "clients") >= 0.8);
  assert.ok(fuzzyTokenScore("prospet", "prospect") >= 0.8);
  assert.equal(fuzzyTokenScore("prospect", "prospection", { prefix: false }), 0);
  assert.equal(fuzzyTokenScore("chat", "chien"), 0);
  assert.ok(jaroWinkler("dupont", "dupond") > 0.9);
});

test("dates : relatives, absolues et jours de semaine", () => {
  assert.equal(extractDate("demain", NOW).iso, "2026-10-04");
  assert.equal(extractDate("hier", NOW).iso, "2026-10-02");
  assert.equal(extractDate("le 12/10/2026", NOW).iso, "2026-10-12");
  assert.equal(extractDate("le 5 novembre", NOW).iso, "2026-11-05");
  assert.equal(extractDate("2026-12-25", NOW).iso, "2026-12-25");
  assert.equal(extractDate("vendredi prochain", NOW).iso, "2026-10-09");
  assert.equal(extractDate("31/02/2026", NOW), null); // date impossible
});

test("periodes : semaine, mois, trimestre, glissantes", () => {
  assert.equal(extractPeriod("ce mois-ci", NOW).fromISO, "2026-10-01");
  assert.equal(extractPeriod("le mois dernier", NOW).fromISO, "2026-09-01");
  assert.equal(extractPeriod("le mois dernier", NOW).toISO, "2026-09-30");
  assert.equal(extractPeriod("cette semaine", NOW).fromISO, "2026-09-28");
  assert.equal(extractPeriod("les 7 derniers jours", NOW).fromISO, "2026-09-27");
  assert.equal(extractPeriod("ce trimestre", NOW).fromISO, "2026-10-01");
  assert.equal(extractPeriod("en septembre", NOW).toISO, "2026-09-30");
  assert.equal(extractPeriod("bonjour", NOW), null);
});

test("montants : formats francais, k, M, devises", () => {
  assert.equal(extractAmounts("15 000 euros")[0].value, 15000);
  assert.equal(extractAmounts("budget 2,5 M")[0].value, 2500000);
  assert.equal(extractAmounts("12k")[0].value, 12000);
  assert.equal(extractAmounts("1.500 €")[0].value, 1500);
  assert.equal(extractAmounts("le 12/10/2026").length, 0); // une date n'est pas un montant
  assert.deepEqual(extractAmountConstraint("plus de 10k"), { min: 10000 });
  assert.deepEqual(extractAmountConstraint("moins de 500 euros"), { max: 500 });
  assert.deepEqual(extractAmountConstraint("entre 1000 et 5000 euros"), { min: 1000, max: 5000 });
});

test("entites : type, statut, champ, noms, entreprise, titre", () => {
  const e = extractEntities("Ajoute le prospect Marie Dupont chez ACME Corp email marie@acme.com", { now: NOW });
  assert.equal(e.entityType, "prospects");
  assert.deepEqual(e.names, ["Marie Dupont"]);
  assert.equal(e.company, "ACME Corp");
  assert.deepEqual(e.emails, ["marie@acme.com"]);

  const s = extractEntities("opportunités gagnées de plus de 10k", { now: NOW });
  assert.equal(s.entityType, "opportunities");
  assert.equal(s.statut, "gagnee");
  assert.deepEqual(s.amountConstraint, { min: 10000 });

  const t = extractEntities('nouvelle opportunité "Refonte site web" de 12 000 euros', { now: NOW });
  assert.equal(t.title, "Refonte site web");
  assert.equal(t.amount, 12000);
  assert.equal(t.names, undefined);

  const c = extractEntities("quel est mon chiffre d'affaires du mois dernier", { now: NOW });
  assert.equal(c.entityType, undefined); // "affaires" de "chiffre d'affaires" n'est pas une opportunite
  assert.equal(c.period.label, "le mois dernier");

  const typo = extractEntities("les cleints inactifs", { now: NOW });
  assert.equal(typo.entityType, "clients");
  assert.equal(typo.statut, "inactif");

  assert.equal(extractEntities("oui", { now: NOW }).yes, true);
  assert.equal(extractEntities("non merci", { now: NOW }).no, true);
});
