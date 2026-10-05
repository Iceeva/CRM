#!/usr/bin/env node
/**
 * scripts/generate-intents-doc.js - Genere docs/INTENTS.md depuis le catalogue reel
 * Usage : node scripts/generate-intents-doc.js
 * La documentation est ainsi toujours synchronisee avec backend/src/chatbot/intents/.
 */
const fs = require("fs");
const path = require("path");
const { INTENTS } = require("../backend/src/chatbot/intents");

const out = [];
out.push("# Catalogue des intentions du chatbot");
out.push("");
out.push("Fichier genere automatiquement par `node scripts/generate-intents-doc.js`. Ne pas modifier a la main.");
out.push("");
out.push(`Le moteur reconnait **${INTENTS.length} intentions** a partir de **${INTENTS.reduce((s, i) => s + i.examples.length, 0)} phrases d'entrainement**.`);
out.push("");

const cats = { social: "Conversation", lecture: "Consultation du CRM", systeme: "Systeme", navigation: "Navigation", ecriture: "Actions d'ecriture (avec confirmation)" };
for (const [cat, title] of Object.entries(cats)) {
  const list = INTENTS.filter((i) => i.category === cat);
  if (!list.length) continue;
  out.push(`## ${title}`);
  out.push("");
  out.push("| Intention | Description | Exemples de phrases |");
  out.push("|---|---|---|");
  for (const i of list) {
    const ex = i.examples.slice(0, 3).map((e) => `"${e}"`).join(", ");
    out.push(`| \`${i.id}\` | ${i.description} | ${ex} |`);
  }
  out.push("");
  for (const i of list.filter((x) => x.slots)) {
    out.push(`### Informations demandees pour \`${i.id}\``);
    out.push("");
    out.push("| Information | Obligatoire | Question posee si elle manque |");
    out.push("|---|---|---|");
    for (const s of i.slots) out.push(`| \`${s.name}\` | ${s.required ? "oui" : "non"} | ${s.prompt || "-"} |`);
    out.push("");
  }
}
fs.writeFileSync(path.join(__dirname, "../docs/INTENTS.md"), out.join("\n") + "\n");
console.log("docs/INTENTS.md genere");
