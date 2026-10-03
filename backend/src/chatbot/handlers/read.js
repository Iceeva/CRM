/**
 * chatbot/handlers/read.js - Handlers de consultation (lecture seule)
 * ----------------------------------------------------------------------------
 * Signature : async (ctx) => { reply, items?, actions?, quickReplies?, record?, data? }
 *   ctx = { text, entities, state, user, now, classification }
 * `record` met a jour state.lastRecord (pour "et son telephone ?").
 */
const storage = require("../../services/storageService");
const { computeStats } = require("../../controllers/dashboardController");
const { OPEN_OPPORTUNITY_STATUTS } = require("../../constants");
const { resolveRecord } = require("../engine/resolver");
const F = require("../engine/format");
const H = require("./helpers");


const NOT_FOUND_HINT = "Verifiez l'orthographe ou donnez-moi son email ou son entreprise.";

/** Reponse standard quand une reference est ambigue ou introuvable. */
function referenceProblem(res, what = "enregistrement") {
  if (res.status === "ambiguous") {
    const options = res.matches.map((m) => ({ id: m.record.id, type: m.type, label: `${F.recordTitle(m.type, m.record)} (${m.type === "clients" ? "client" : m.type === "prospects" ? "prospect" : "opportunite"})` }));
    return {
      reply: `Plusieurs ${what}s correspondent a "${res.term}". Lequel voulez-vous ?`,
      choose: options,
      quickReplies: options.map((o) => o.label),
    };
  }
  return { reply: `Je n'ai trouve aucun ${what} correspondant${res.term ? ` a "${res.term}"` : ""}. ${NOT_FOUND_HINT}` };
}

const FIELD_LABELS = {
  email: "email",
  telephone: "telephone",
  entreprise: "entreprise",
  notes: "notes",
  statut: "statut",
  montant: "montant",
  source: "source",
  date_cloture: "date de cloture",
};

/* ------------------------------------------------------------------ */

exports.statsOverview = async () => {
  const s = await computeStats();
  return {
    reply: [
      "Voici le resume de votre activite :",
      `- Clients : ${s.totalClients} (${s.clientsByStatut.actif || 0} actifs)`,
      `- Prospects : ${s.totalProspects} (${s.prospectsNouveaux} nouveaux, ${s.prospectsContactes} contactes, ${s.prospectsConvertis} convertis)`,
      `- Opportunites : ${s.totalOpportunities} dont ${s.oppGagnees} gagnees et ${s.oppPerdues} perdues`,
      `- Chiffre d'affaires gagne : ${F.money(s.totalRevenue)}`,
      `- Pipeline ouvert : ${F.money(s.pipelineValue)} sur ${s.oppOuvertes} opportunite(s)`,
      `- Interactions enregistrees : ${s.totalInteractions}`,
    ].join("\n"),
    quickReplies: ["Qui dois-je relancer ?", "Plus grosses opportunites", "Taux de conversion"],
    actions: [{ type: "navigate", to: "/", label: "Ouvrir le tableau de bord" }],
  };
};

exports.countRecords = async ({ entities, state }) => {
  const type = inferType(entities, state);
  if (!type) {
    return { reply: "Que voulez-vous compter ? Des clients, des prospects, des opportunites ou des interactions ?", quickReplies: ["Combien de clients ?", "Combien de prospects ?", "Combien d'opportunites ?"] };
  }
  const statut = entities.statut;
  if (statut && !H.VALID_STATUTS[type].includes(statut)) {
    return { reply: `Le statut "${statut}" ne s'applique pas aux ${F.LABELS[type].plural}.` };
  }

  let list = (await H.fetchAll(type)).data;
  if (statut) list = H.applyStatut(list, statut);
  if (entities.interactionType && type === "interactions") list = list.filter((r) => r.type === entities.interactionType);
  if (entities.period) list = H.applyPeriod(list, entities.period, type === "interactions" ? "date" : "created_at");
  if (entities.amountConstraint && type === "opportunities") list = H.applyAmount(list, entities.amountConstraint);

  const n = list.length;
  const parts = [];
  if (statut) parts.push(F.statutLabel(statut, type, n > 1));
  if (entities.interactionType && type === "interactions") parts.push(`de type ${entities.interactionType}`);
  if (entities.period) parts.push(`sur ${entities.period.label}`);
  const qualifier = parts.length ? ` ${parts.join(" ")}` : "";
  const total = n === 0 ? `Il n'y a ${F.count(0, type)}${qualifier}.` : `Vous avez ${F.count(n, type)}${qualifier}.`;

  let extra = "";
  if (type === "opportunities" && n > 0) extra = ` Montant cumule : ${F.money(list.reduce((s, o) => s + (Number(o.montant) || 0), 0))}.`;
  return {
    reply: total + extra,
    quickReplies: n > 0 ? [`Liste des ${F.LABELS[type].plural}${statut ? " " + F.statutLabel(statut, type, true) : ""}`] : [],
    resource: type,
  };
};

exports.listRecords = async ({ entities, state }) => {
  const type = inferType(entities, state);
  if (!type) {
    return { reply: "Quelle liste souhaitez-vous voir ? Clients, prospects, opportunites ou interactions ?", quickReplies: ["Mes clients", "Mes prospects", "Mes opportunites", "Mes interactions"] };
  }
  const statut = entities.statut;
  if (statut && !H.VALID_STATUTS[type].includes(statut)) {
    return { reply: `Le statut "${statut}" ne s'applique pas aux ${F.LABELS[type].plural}.` };
  }

  const all = await H.fetchAll(type);
  let list = all.data;
  if (statut) list = H.applyStatut(list, statut);
  if (entities.interactionType && type === "interactions") list = list.filter((r) => r.type === entities.interactionType);
  if (entities.period) list = H.applyPeriod(list, entities.period, type === "interactions" ? "date" : "created_at");
  if (entities.amountConstraint && type === "opportunities") {
    list = H.applyAmount(list, entities.amountConstraint).sort((a, b) => b.montant - a.montant);
  }
  if (entities.sort === "asc") list = [...list].reverse();

  const limit = Math.min(entities.count || 8, 20);
  const shown = list.slice(0, limit);
  const desc = [];
  if (statut) desc.push(F.statutLabel(statut, type, true));
  if (entities.amountConstraint) {
    const c = entities.amountConstraint;
    desc.push(c.min !== undefined && c.max !== undefined ? `entre ${F.money(c.min)} et ${F.money(c.max)}` : c.min !== undefined ? `de plus de ${F.money(c.min)}` : `de moins de ${F.money(c.max)}`);
  }
  if (entities.period) desc.push(`sur ${entities.period.label}`);
  const qualifier = desc.length ? ` ${desc.join(" ")}` : "";

  if (!list.length) return { reply: `Aucun${F.LABELS[type].feminine ? "e" : ""} ${F.LABELS[type].singular}${qualifier} pour le moment.`, resource: type };

  const head = `${F.count(list.length, type)}${qualifier}${list.length > shown.length ? ` (${shown.length} affiches)` : ""} :`;
  return {
    reply: `${head}\n${F.bulletList(type, shown, limit)}`,
    items: shown.map((r) => F.toItem(type, r)),
    actions: [{ type: "navigate", to: F.ROUTES[type], label: `Ouvrir la page ${F.LABELS[type].plural}` }],
    resource: type,
    record: shown.length === 1 ? H.recordRef(type, shown[0]) : undefined,
  };
};

exports.findRecord = async ({ entities, state }) => {
  const res = await resolveRecord(entities, { state, allowResidual: true });
  if (res.status === "none") return referenceProblem(res);
  const matches = res.matches.slice(0, 5);
  if (res.status === "resolved" && matches.length === 1) {
    const m = matches[0];
    return {
      reply: `J'ai trouve ${m.type === "opportunities" ? "l'opportunite" : m.type === "prospects" ? "le prospect" : "le client"} ${F.recordTitle(m.type, m.record)} (${F.recordSubtitle(m.type, m.record)}).`,
      items: [F.toItem(m.type, m.record)],
      record: H.recordRef(m.type, m.record),
      resource: m.type,
      quickReplies: ["Voir sa fiche", "Son telephone", "Historique des echanges"],
    };
  }
  return {
    reply: `${matches.length} resultats pour "${res.term}" :\n${matches.map((m) => `- ${F.recordTitle(m.type, m.record)} (${m.type === "clients" ? "client" : m.type === "prospects" ? "prospect" : "opportunite"}) : ${F.recordSubtitle(m.type, m.record)}`).join("\n")}`,
    items: matches.map((m) => F.toItem(m.type, m.record)),
  };
};

exports.getContactInfo = async ({ entities, state }) => {
  const res = await resolveRecord(entities, { state, types: ["clients", "prospects", "opportunities"], allowResidual: true });
  if (res.status !== "resolved") return referenceProblem(res, "contact");
  const { type, record: r } = res.match;
  const name = F.recordTitle(type, r);
  const field = entities.field;
  const ref = H.recordRef(type, r);

  if (type === "opportunities") {
    const client = r.client_id ? await storage.findById("clients", r.client_id) : null;
    const map = { montant: `Le montant de "${r.titre}" est de ${F.money(r.montant)}.`, statut: `"${r.titre}" est ${F.statutLabel(r.statut, "opportunities")}.`, date_cloture: r.date_cloture ? `"${r.titre}" doit se cloturer le ${F.dateFr(r.date_cloture)}.` : `Aucune date de cloture n'est definie pour "${r.titre}".` };
    return { reply: map[field] || `"${r.titre}" : ${F.money(r.montant)}, ${F.statutLabel(r.statut, "opportunities")}${client ? `, client ${client.nom}` : ""}.`, record: ref };
  }

  const values = {
    email: r.email ? `L'email de ${name} est ${r.email}.` : `Je n'ai pas d'email pour ${name}.`,
    telephone: r.telephone ? `Le telephone de ${name} est ${r.telephone}.` : `Je n'ai pas de numero de telephone pour ${name}.`,
    entreprise: r.entreprise ? `${name} travaille chez ${r.entreprise}.` : `Aucune entreprise n'est renseignee pour ${name}.`,
    notes: r.notes ? `Notes sur ${name} : ${r.notes}` : `Aucune note pour ${name}.`,
    statut: `${name} est ${F.statutLabel(r.statut, type)}.`,
    source: r.source ? `La source de ${name} est "${r.source}".` : `Aucune source n'est renseignee pour ${name}.`,
  };
  if (field && values[field]) return { reply: values[field], record: ref, resource: type, quickReplies: ["Voir sa fiche", "Historique des echanges"] };

  const lines = [`Coordonnees de ${name} :`];
  lines.push(`- Email : ${r.email || "non renseigne"}`);
  lines.push(`- Telephone : ${r.telephone || "non renseigne"}`);
  lines.push(`- Entreprise : ${r.entreprise || "non renseignee"}`);
  return { reply: lines.join("\n"), record: ref, resource: type, items: [F.toItem(type, r)] };
};

exports.recordDetails = async ({ entities, state }) => {
  const res = await resolveRecord(entities, { state, allowResidual: true });
  if (res.status !== "resolved") return referenceProblem(res);
  const { type, record: r } = res.match;
  const ref = H.recordRef(type, r);

  if (type === "opportunities") {
    const client = r.client_id ? await storage.findById("clients", r.client_id) : null;
    return {
      reply: [
        `Opportunite "${r.titre}"`,
        `- Montant : ${F.money(r.montant)}`,
        `- Statut : ${F.statutLabel(r.statut, type)}`,
        `- Client : ${client ? client.nom : "non rattachee"}`,
        `- Cloture prevue : ${r.date_cloture ? F.dateFr(r.date_cloture) : "non definie"}`,
        r.description ? `- Description : ${r.description}` : null,
      ].filter(Boolean).join("\n"),
      record: ref, resource: type, items: [F.toItem(type, r)],
    };
  }

  const filterKey = type === "clients" ? "client_id" : "prospect_id";
  const [inter, opps] = await Promise.all([
    storage.findAll("interactions", { filters: { [filterKey]: r.id }, limit: 100 }),
    type === "clients" ? storage.findAll("opportunities", { filters: { client_id: r.id }, limit: 100 }) : Promise.resolve({ data: [] }),
  ]);
  const lines = [
    `${type === "clients" ? "Client" : "Prospect"} ${r.nom}`,
    `- Statut : ${F.statutLabel(r.statut, type)}`,
    `- Entreprise : ${r.entreprise || "non renseignee"}`,
    `- Email : ${r.email || "non renseigne"}`,
    `- Telephone : ${r.telephone || "non renseigne"}`,
    r.source ? `- Source : ${r.source}` : null,
    `- Interactions : ${inter.total}${inter.data[0] ? ` (derniere : ${inter.data[0].sujet}, ${F.dateFr(inter.data[0].date)})` : ""}`,
  ];
  if (type === "clients") {
    const won = opps.data.filter((o) => o.statut === "gagnee").reduce((s, o) => s + o.montant, 0);
    lines.push(`- Opportunites : ${opps.data.length} (${F.money(won)} gagnes)`);
  }
  if (r.notes) lines.push(`- Notes : ${r.notes}`);
  return {
    reply: lines.filter(Boolean).join("\n"),
    record: ref, resource: type, items: [F.toItem(type, r)],
    actions: [{ type: "navigate", to: `${F.ROUTES[type]}/${r.id}`, label: "Ouvrir la fiche" }],
    quickReplies: ["Historique des echanges", "Son telephone"],
  };
};

exports.revenueTotal = async ({ entities }) => {
  const period = entities.period;
  if (!period) {
    const total = await storage.sum("opportunities", "montant", { statut: "gagnee" });
    const n = await storage.count("opportunities", { statut: "gagnee" });
    return { reply: `Votre chiffre d'affaires gagne s'eleve a ${F.money(total)} sur ${F.count(n, "opportunities")}.`, quickReplies: ["Chiffre d'affaires du mois dernier", "Valeur du pipeline"] };
  }
  const won = (await H.fetchAll("opportunities", { filters: { statut: "gagnee" } })).data;
  // Une affaire gagnee compte a sa date de cloture, a defaut a sa derniere mise a jour
  const inPeriod = won.filter((o) => {
    const d = new Date(o.date_cloture || o.updated_at || o.created_at);
    return d >= period.from && d <= period.to;
  });
  const total = inPeriod.reduce((s, o) => s + (Number(o.montant) || 0), 0);
  if (!inPeriod.length) return { reply: `Aucune opportunite gagnee sur ${period.label}.` };
  return {
    reply: `Chiffre d'affaires sur ${period.label} : ${F.money(total)} (${F.count(inPeriod.length, "opportunities")} gagnee${inPeriod.length > 1 ? "s" : ""}).\n${F.bulletList("opportunities", inPeriod.sort((a, b) => b.montant - a.montant), 5)}`,
    items: inPeriod.slice(0, 5).map((o) => F.toItem("opportunities", o)),
  };
};

exports.pipelineOverview = async () => {
  const [count, amount] = await Promise.all([storage.groupCount("opportunities", "statut"), storage.groupSum("opportunities", "statut", "montant")]);
  const order = ["prospection", "qualification", "proposition", "negociation"];
  const open = order.reduce((s, k) => s + (amount[k] || 0), 0);
  const openCount = order.reduce((s, k) => s + (count[k] || 0), 0);
  const lines = order.map((k) => `- ${k[0].toUpperCase() + k.slice(1)} : ${count[k] || 0} opportunite(s), ${F.money(amount[k] || 0)}`);
  return {
    reply: [`Pipeline ouvert : ${F.money(open)} sur ${openCount} opportunite(s).`, ...lines, `Deja gagne : ${F.money(amount.gagnee || 0)} - perdu : ${F.money(amount.perdue || 0)}.`].join("\n"),
    quickReplies: ["Plus grosses opportunites", "Quelles affaires sont en retard ?"],
    actions: [{ type: "navigate", to: "/opportunities", label: "Ouvrir les opportunites" }],
  };
};

exports.topOpportunities = async ({ entities }) => {
  let list = (await H.fetchAll("opportunities")).data;
  if (entities.statut) list = H.applyStatut(list, entities.statut);
  list = list.sort((a, b) => (entities.sort === "asc" ? a.montant - b.montant : b.montant - a.montant));
  const n = Math.min(entities.count || 3, 10);
  const top = list.slice(0, n);
  if (!top.length) return { reply: "Aucune opportunite a classer pour le moment." };
  return {
    reply: `Top ${top.length} des opportunites par montant :\n${F.bulletList("opportunities", top, n)}`,
    items: top.map((o) => F.toItem("opportunities", o)),
    record: top.length === 1 ? H.recordRef("opportunities", top[0]) : undefined,
    resource: "opportunities",
  };
};

exports.closingSoon = async ({ entities, now }) => {
  const open = H.applyStatut((await H.fetchAll("opportunities")).data, "ouvertes").filter((o) => o.date_cloture);
  const overdue = open.filter((o) => H.isOverdue(o, now)).sort((a, b) => new Date(a.date_cloture) - new Date(b.date_cloture));
  const horizon = entities.period ? entities.period.to : new Date(now.getTime() + 30 * 86400000);
  const start = entities.period ? entities.period.from : now;
  const upcoming = open.filter((o) => !H.isOverdue(o, now) && new Date(o.date_cloture) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && new Date(o.date_cloture) <= horizon && new Date(o.date_cloture) >= new Date(start.getFullYear(), start.getMonth(), start.getDate())).sort((a, b) => new Date(a.date_cloture) - new Date(b.date_cloture));
  const lines = [];
  if (overdue.length) lines.push(`En retard (${overdue.length}) :`, F.bulletList("opportunities", overdue, 6));
  if (upcoming.length) lines.push(`${entities.period ? `Sur ${entities.period.label}` : "Dans les 30 prochains jours"} (${upcoming.length}) :`, F.bulletList("opportunities", upcoming, 6));
  if (!lines.length) return { reply: "Aucune opportunite ouverte n'arrive a echeance dans cette periode et aucune n'est en retard." };
  return { reply: lines.join("\n"), items: [...overdue, ...upcoming].slice(0, 8).map((o) => F.toItem("opportunities", o)), actions: [{ type: "navigate", to: "/opportunities", label: "Ouvrir les opportunites" }] };
};

exports.recentActivity = async ({ entities }) => {
  let list = (await H.fetchAll("interactions")).data;
  if (entities.interactionType) list = list.filter((i) => i.type === entities.interactionType);
  if (entities.period) list = H.applyPeriod(list, entities.period, "date");
  list = list.sort((a, b) => new Date(b.date) - new Date(a.date));
  const n = Math.min(entities.count || 5, 15);
  const shown = list.slice(0, n);
  if (!shown.length) return { reply: `Aucune interaction${entities.interactionType ? " de ce type" : ""}${entities.period ? ` sur ${entities.period.label}` : ""}.` };
  return {
    reply: `${shown.length === list.length ? F.count(list.length, "interactions") : `Les ${shown.length} dernieres interactions`}${entities.period ? ` sur ${entities.period.label}` : ""} :\n${F.bulletList("interactions", shown, n)}`,
    items: shown.map((i) => F.toItem("interactions", i)),
    actions: [{ type: "navigate", to: "/interactions", label: "Ouvrir les interactions" }],
  };
};

exports.conversionRate = async () => {
  const s = await computeStats();
  const converted = s.prospectsConvertis;
  const total = s.totalProspects;
  if (!total) return { reply: "Aucun prospect enregistre : le taux de conversion ne peut pas etre calcule." };
  return {
    reply: `Taux de conversion : ${s.conversionRate} % (${converted} prospect(s) converti(s) sur ${total}).\nRepartition : ${s.prospectsNouveaux} nouveau(x), ${s.prospectsContactes} contacte(s), ${converted} converti(s).`,
    quickReplies: ["Qui dois-je relancer ?", "Liste des prospects nouveaux"],
  };
};

exports.interactionHistory = async ({ entities, state }) => {
  const res = await resolveRecord(entities, { state, types: ["clients", "prospects"], allowResidual: true });
  if (res.status !== "resolved") return referenceProblem(res, "contact");
  const { type, record: r } = res.match;
  const key = type === "clients" ? "client_id" : "prospect_id";
  let list = (await H.fetchAll("interactions", { filters: { [key]: r.id } })).data;
  if (entities.interactionType) list = list.filter((i) => i.type === entities.interactionType);
  if (entities.period) list = H.applyPeriod(list, entities.period, "date");
  list = list.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!list.length) return { reply: `Aucune interaction enregistree avec ${r.nom}.`, record: H.recordRef(type, r), quickReplies: [`J'ai appele ${r.nom}`] };
  const last = list[0];
  const days = H.daysBetween(last.date, new Date());
  return {
    reply: `${F.count(list.length, "interactions")} avec ${r.nom}. Derniere : ${last.type} "${last.sujet}" le ${F.dateFr(last.date)} (il y a ${days} jour${days > 1 ? "s" : ""}).\n${F.bulletList("interactions", list, 6)}`,
    items: list.slice(0, 6).map((i) => F.toItem("interactions", i)),
    record: H.recordRef(type, r),
  };
};

exports.followupSuggestions = async ({ now }) => {
  const [prospects, clients, opps, inter] = await Promise.all([
    H.fetchAll("prospects"), H.fetchAll("clients"), H.fetchAll("opportunities"), H.fetchAll("interactions"),
  ]);
  const lastBy = {};
  inter.data.forEach((i) => {
    [i.client_id, i.prospect_id].filter(Boolean).forEach((id) => {
      if (!lastBy[id] || new Date(i.date) > new Date(lastBy[id])) lastBy[id] = i.date;
    });
  });
  const age = (d) => H.daysBetween(d, now);

  const items = [];
  prospects.data.filter((p) => p.statut === "nouveau" && age(p.created_at) >= 2).forEach((p) => items.push({ type: "prospects", r: p, why: `nouveau depuis ${age(p.created_at)} jour(s), jamais contacte`, prio: 3 + Math.min(age(p.created_at), 30) / 30 }));
  prospects.data.filter((p) => p.statut === "contacte" && (!lastBy[p.id] || age(lastBy[p.id]) >= 7)).forEach((p) => items.push({ type: "prospects", r: p, why: lastBy[p.id] ? `sans nouvelle depuis ${age(lastBy[p.id])} jours` : "contacte mais aucune interaction enregistree", prio: 2.5 }));
  opps.data.filter((o) => OPEN_OPPORTUNITY_STATUTS.includes(o.statut) && H.isOverdue(o, now)).forEach((o) => items.push({ type: "opportunities", r: o, why: `cloture depassee depuis le ${F.dateFr(o.date_cloture)} (${F.money(o.montant)})`, prio: 4 + Math.min(o.montant / 100000, 1) }));
  clients.data.filter((c) => c.statut === "actif" && (!lastBy[c.id] || age(lastBy[c.id]) >= 30)).forEach((c) => items.push({ type: "clients", r: c, why: lastBy[c.id] ? `aucun echange depuis ${age(lastBy[c.id])} jours` : "aucun echange enregistre", prio: 1.5 }));

  items.sort((a, b) => b.prio - a.prio);
  if (!items.length) return { reply: "Tout est a jour : aucun prospect, client ou opportunite ne demande de relance pour le moment." };
  const top = items.slice(0, 7);
  return {
    reply: `Voici ${top.length === items.length ? "les" : `les ${top.length} principales`} relances a prevoir :\n${top.map((i) => `- ${F.recordTitle(i.type, i.r)} (${i.type === "clients" ? "client" : i.type === "prospects" ? "prospect" : "opportunite"}) : ${i.why}`).join("\n")}`,
    items: top.map((i) => F.toItem(i.type, i.r)),
    quickReplies: [`J'ai appele ${top[0].type !== "opportunities" ? F.recordTitle(top[0].type, top[0].r) : "un client"}`],
  };
};

exports.storageStatus = async () => {
  await storage.ping().catch(() => false);
  const st = storage.status();
  if (storage.isPostgres()) return { reply: "Les donnees sont stockees dans Neon PostgreSQL via Prisma. La connexion est active." };
  if (st.configured) return { reply: "Neon PostgreSQL est configure mais injoignable pour le moment. Le CRM fonctionne en mode de secours JSON et reessaiera automatiquement." };
  return { reply: "Le CRM fonctionne en mode JSON (aucune base configuree). Renseignez DATABASE_URL pour utiliser Neon PostgreSQL." };
};

exports.navigate = async ({ entities, text }) => {
  const clean = text.toLowerCase();
  const target = entities.entityType ? F.ROUTES[entities.entityType] : /tableau de bord|dashboard|accueil/.test(clean) ? "/" : null;
  if (!target) return { reply: "Quelle page voulez-vous ouvrir ? Clients, prospects, opportunites, interactions ou tableau de bord ?", quickReplies: ["Page clients", "Page prospects", "Page opportunites", "Tableau de bord"] };
  const label = target === "/" ? "le tableau de bord" : `la page ${entities.entityType === "opportunities" ? "opportunites" : entities.entityType}`;
  return { reply: `J'ouvre ${label}.`, actions: [{ type: "navigate", to: target, label: `Ouvrir ${label}`, auto: true }] };
};

