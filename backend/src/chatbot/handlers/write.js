/**
 * chatbot/handlers/write.js - Actions d'ecriture (creation, modification, suppression)
 * ----------------------------------------------------------------------------
 * Chaque action expose 4 fonctions utilisees par engine/dialog.js :
 *
 *   fill(entities, slots, ctx)      remplit les slots a partir de la phrase (synchrone)
 *   resolve(slots, ctx)             resout les references (cible, client) en enregistrements
 *                                   -> { slots, problem?: { reply, choose? } }
 *   summary(slots)                  texte de confirmation presente a l'utilisateur
 *   execute(slots, ctx)             execute l'action -> { reply, record?, actions? }
 *
 * AUCUNE ecriture n'a lieu sans confirmation explicite de l'utilisateur.
 */
const storage = require("../../services/storageService");
const { newId } = require("../../utils/id");
const { convertProspect } = require("../../controllers/prospectsController");
const { EMAIL_RE } = require("../../middlewares/validate");
const { resolveRecord } = require("../engine/resolver");
const F = require("../engine/format");
const H = require("./helpers");

const TYPE_LABEL = { clients: "client", prospects: "prospect", opportunities: "opportunite", interactions: "interaction" };
const TYPE_ARTICLE = { clients: "le client", prospects: "le prospect", opportunities: "l'opportunite", interactions: "l'interaction" };

const firstOf = (v) => (Array.isArray(v) ? v[0] : v);
const set = (slots, key, value) => {
  if (value !== undefined && value !== null && value !== "" && slots[key] === undefined) slots[key] = value;
};

/** Reponse "reference introuvable ou ambigue" commune. */
function problemFrom(res, label) {
  if (res.status === "ambiguous") {
    const options = res.matches.map((m) => ({ id: m.record.id, type: m.type, label: `${F.recordTitle(m.type, m.record)} (${TYPE_LABEL[m.type]})` }));
    return { reply: `Plusieurs ${label}s correspondent a "${res.term}". Lequel voulez-vous ?`, choose: options };
  }
  return { reply: `Je n'ai trouve aucun ${label}${res.term ? ` correspondant a "${res.term}"` : ""}. Donnez-moi son nom exact ou son email.` };
}

/** Texte brut d'une reference (ou d'un enregistrement deja resolu). */
const isRef = (v) => v && typeof v === "object" && v.id;

/* ================================================================== */
/*  Creation : client / prospect                                       */
/* ================================================================== */

function personFill(entities, slots) {
  set(slots, "nom", firstOf(entities.names));
  set(slots, "email", firstOf(entities.emails));
  set(slots, "telephone", firstOf(entities.phones));
  set(slots, "entreprise", entities.company);
  if (!slots.nom && entities.residual && entities.residual.length && entities.names === undefined) {
    // "ajoute marie dupont" en minuscules : les mots inconnus forment le nom
    const guess = entities.residual.filter((w) => w.length >= 2 && !["email", "mail"].includes(w)).slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    if (guess && !entities.emails) slots._nomGuess = guess;
  }
  return slots;
}

function personSummary(kind) {
  return (s) =>
    [
      `Creer ${kind === "clients" ? "le client" : "le prospect"} :`,
      `- Nom : ${s.nom}`,
      `- Email : ${s.email}`,
      s.telephone ? `- Telephone : ${s.telephone}` : null,
      s.entreprise ? `- Entreprise : ${s.entreprise}` : null,
    ].filter(Boolean).join("\n");
}

async function duplicateCheck(type, slots) {
  const found = await storage.findAll(type, { filters: { email: String(slots.email).toLowerCase() }, limit: 1 });
  return found.data[0] || null;
}

const createClient = {
  fill: personFill,
  async resolve(slots) {
    if (slots.email && !EMAIL_RE.test(slots.email)) return { slots, problem: { reply: `"${slots.email}" ne ressemble pas a une adresse email valide.` }, invalid: "email" };
    return { slots };
  },
  summary: personSummary("clients"),
  async execute(s) {
    const dup = await duplicateCheck("clients", s);
    if (dup) return { reply: `Un client avec l'email ${s.email} existe deja : ${dup.nom}. Aucune creation effectuee.`, record: H.recordRef("clients", dup) };
    const c = await storage.create("clients", {
      id: newId(), nom: s.nom, email: String(s.email).toLowerCase(), telephone: s.telephone || "", entreprise: s.entreprise || "", statut: "actif", notes: "", source: "chatbot",
    });
    return { reply: `Client ${c.nom} cree avec succes.`, record: H.recordRef("clients", c), resource: "clients", items: [F.toItem("clients", c)], actions: [{ type: "navigate", to: `/clients/${c.id}`, label: "Ouvrir la fiche" }, { type: "refresh" }] };
  },
};

const createProspect = {
  fill: personFill,
  resolve: createClient.resolve,
  summary: personSummary("prospects"),
  async execute(s) {
    const dup = await duplicateCheck("prospects", s);
    if (dup) return { reply: `Un prospect avec l'email ${s.email} existe deja : ${dup.nom}. Aucune creation effectuee.`, record: H.recordRef("prospects", dup) };
    const p = await storage.create("prospects", {
      id: newId(), nom: s.nom, email: String(s.email).toLowerCase(), telephone: s.telephone || "", entreprise: s.entreprise || "", source: s.source || "chatbot", statut: "nouveau", notes: "",
    });
    return { reply: `Prospect ${p.nom} cree avec succes.`, record: H.recordRef("prospects", p), resource: "prospects", items: [F.toItem("prospects", p)], actions: [{ type: "navigate", to: `/prospects/${p.id}`, label: "Ouvrir la fiche" }, { type: "refresh" }] };
  },
};

/* ================================================================== */
/*  Creation : opportunite                                             */
/* ================================================================== */

const createOpportunity = {
  fill(entities, slots) {
    set(slots, "titre", entities.title);
    set(slots, "montant", entities.amount);
    set(slots, "client", firstOf(entities.names) || entities.company);
    set(slots, "date_cloture", entities.date);
    return slots;
  },
  async resolve(slots, ctx) {
    // Le client est optionnel : on tente la resolution, sans bloquer si introuvable
    if (slots.client && !isRef(slots.client)) {
      const res = await resolveRecord({ names: [slots.client], company: slots.client }, { types: ["clients"], state: ctx.state, allowResidual: false });
      if (res.status === "resolved") slots.client = H.recordRef("clients", res.match.record);
      else if (res.status === "ambiguous") return { slots, problem: problemFrom(res, "client") };
      else {
        slots._clientIntrouvable = slots.client;
        delete slots.client;
      }
    }
    return { slots };
  },
  summary(s) {
    return [
      "Creer l'opportunite :",
      `- Intitule : ${s.titre}`,
      `- Montant : ${F.money(s.montant)}`,
      `- Client : ${isRef(s.client) ? s.client.nom : s._clientIntrouvable ? `aucun ("${s._clientIntrouvable}" est introuvable)` : "aucun"}`,
      s.date_cloture ? `- Cloture prevue : ${F.dateFr(s.date_cloture)}` : null,
      "- Statut initial : prospection",
    ].filter(Boolean).join("\n");
  },
  async execute(s) {
    const o = await storage.create("opportunities", {
      id: newId(), client_id: isRef(s.client) ? s.client.id : null, titre: s.titre, montant: Number(s.montant) || 0, statut: "prospection", description: "", date_cloture: s.date_cloture || null,
    });
    return { reply: `Opportunite "${o.titre}" creee (${F.money(o.montant)}).`, record: H.recordRef("opportunities", o), resource: "opportunities", items: [F.toItem("opportunities", o)], actions: [{ type: "navigate", to: "/opportunities", label: "Ouvrir les opportunites" }, { type: "refresh" }] };
  },
};

/* ================================================================== */
/*  Interaction                                                        */
/* ================================================================== */

const DEFAULT_SUBJECT = { appel: "Appel avec", email: "Email a", reunion: "Reunion avec", note: "Note pour" };

const logInteraction = {
  fill(entities, slots) {
    set(slots, "cible", firstOf(entities.names) || entities.company);
    set(slots, "type", entities.interactionType);
    set(slots, "sujet", entities.title);
    set(slots, "date", entities.date);
    return slots;
  },
  async resolve(slots, ctx) {
    if (slots.cible && !isRef(slots.cible)) {
      const res = await resolveRecord({ names: [slots.cible], company: slots.cible }, { types: ["clients", "prospects"], state: ctx.state, allowResidual: false });
      if (res.status === "resolved") slots.cible = H.recordRef(res.match.type, res.match.record);
      else {
        delete slots.cible;
        return { slots, problem: problemFrom(res, "client ou prospect") };
      }
    }
    return { slots };
  },
  summary(s) {
    const subject = s.sujet || `${DEFAULT_SUBJECT[s.type] || "Echange avec"} ${s.cible.nom}`;
    return [
      "Enregistrer l'interaction :",
      `- Avec : ${s.cible.nom} (${TYPE_LABEL[s.cible.type]})`,
      `- Type : ${s.type}`,
      `- Sujet : ${subject}`,
      `- Date : ${F.dateFr(s.date || new Date())}`,
    ].join("\n");
  },
  async execute(s) {
    const subject = s.sujet || `${DEFAULT_SUBJECT[s.type] || "Echange avec"} ${s.cible.nom}`;
    const when = s.date ? new Date(`${s.date}T09:00:00`) : new Date();
    const i = await storage.create("interactions", {
      id: newId(),
      client_id: s.cible.type === "clients" ? s.cible.id : null,
      prospect_id: s.cible.type === "prospects" ? s.cible.id : null,
      type: s.type, sujet: subject, contenu: "", date: when.toISOString(),
    });
    return { reply: `Interaction enregistree : ${i.type} "${i.sujet}" le ${F.dateFr(i.date)}.`, record: s.cible, resource: "interactions", items: [F.toItem("interactions", i)], actions: [{ type: "refresh" }] };
  },
};

/* ================================================================== */
/*  Conversion prospect -> client                                      */
/* ================================================================== */

const convertProspectAction = {
  fill(entities, slots) {
    set(slots, "cible", firstOf(entities.names) || entities.company);
    return slots;
  },
  async resolve(slots, ctx) {
    if (slots.cible && !isRef(slots.cible)) {
      const res = await resolveRecord({ names: [slots.cible], company: slots.cible }, { types: ["prospects"], state: ctx.state, allowResidual: false });
      if (res.status !== "resolved") {
        delete slots.cible;
        return { slots, problem: problemFrom(res, "prospect") };
      }
      slots.cible = H.recordRef("prospects", res.match.record);
      slots._statut = res.match.record.statut;
    } else if (isRef(slots.cible) && slots.cible.type !== "prospects") {
      delete slots.cible;
      return { slots, problem: { reply: "Seul un prospect peut etre converti en client." } };
    }
    if (slots._statut === "converti") {
      return { slots, problem: { reply: `${slots.cible.nom} est deja converti en client.` }, final: true };
    }
    return { slots };
  },
  summary: (s) => `Convertir le prospect ${s.cible.nom} en client ? Une fiche client sera creee, le prospect passera au statut "converti" et l'operation sera journalisee.`,
  async execute(s) {
    const { client } = await convertProspect(s.cible.id);
    return { reply: `${client.nom} est maintenant client.`, record: H.recordRef("clients", client), resource: "clients", items: [F.toItem("clients", client)], actions: [{ type: "navigate", to: `/clients/${client.id}`, label: "Ouvrir la fiche client" }, { type: "refresh" }] };
  },
};

/* ================================================================== */
/*  Changement de statut                                               */
/* ================================================================== */

const updateStatus = {
  fill(entities, slots) {
    set(slots, "cible", entities.title || firstOf(entities.names) || entities.company);
    if (entities.entityType && !slots._type) slots._type = entities.entityType;
    set(slots, "statut", entities.statut);
    if (!slots.cible && entities.pronoun) slots._usePrevious = true;
    return slots;
  },
  async resolve(slots, ctx) {
    if (slots._usePrevious && !slots.cible && ctx.state.lastRecord) {
      slots.cible = ctx.state.lastRecord;
      delete slots._usePrevious;
    }
    if (slots.cible && !isRef(slots.cible)) {
      const types = slots._type && slots._type !== "interactions" ? [slots._type] : ["clients", "prospects", "opportunities"];
      const res = await resolveRecord({ names: [slots.cible], title: slots.cible, company: slots.cible }, { types, state: ctx.state, allowResidual: false });
      if (res.status !== "resolved") {
        delete slots.cible;
        return { slots, problem: problemFrom(res, "enregistrement") };
      }
      slots.cible = H.recordRef(res.match.type, res.match.record);
      slots._ancien = res.match.record.statut;
    }
    if (isRef(slots.cible) && slots.statut) {
      const valid = H.VALID_STATUTS[slots.cible.type].filter((x) => x !== "ouvertes");
      if (!valid.includes(slots.statut)) {
        const bad = slots.statut;
        delete slots.statut;
        return { slots, problem: { reply: `Le statut "${bad}" ne s'applique pas a ${TYPE_ARTICLE[slots.cible.type]} ${slots.cible.nom}. Statuts possibles : ${valid.join(", ")}.`, quickReplies: valid } };
      }
      if (slots._ancien && slots._ancien === slots.statut) return { slots, problem: { reply: `${slots.cible.nom} est deja au statut "${slots.statut}".` }, final: true };
    }
    return { slots };
  },
  summary: (s) => `Passer ${TYPE_ARTICLE[s.cible.type]} ${s.cible.nom} ${s._ancien ? `de "${s._ancien}" ` : ""}au statut "${s.statut}" ?`,
  async execute(s) {
    const updated = await storage.update(s.cible.type, s.cible.id, { statut: s.statut });
    if (!updated) return { reply: "Cet enregistrement n'existe plus." };
    return { reply: `${s.cible.nom} est maintenant "${s.statut}".`, record: s.cible, resource: s.cible.type, items: [F.toItem(s.cible.type, updated)], actions: [{ type: "refresh" }] };
  },
};

/* ================================================================== */
/*  Suppression                                                        */
/* ================================================================== */

const deleteRecord = {
  fill(entities, slots) {
    set(slots, "cible", entities.title || firstOf(entities.names) || entities.company);
    if (entities.entityType && !slots._type) slots._type = entities.entityType;
    if (!slots.cible && entities.pronoun) slots._usePrevious = true;
    return slots;
  },
  async resolve(slots, ctx) {
    if (slots._usePrevious && !slots.cible && ctx.state.lastRecord) {
      slots.cible = ctx.state.lastRecord;
      delete slots._usePrevious;
    }
    if (slots.cible && !isRef(slots.cible)) {
      const types = slots._type && slots._type !== "interactions" ? [slots._type] : ["clients", "prospects", "opportunities"];
      const res = await resolveRecord({ names: [slots.cible], title: slots.cible, company: slots.cible }, { types, state: ctx.state, allowResidual: false });
      if (res.status !== "resolved") {
        delete slots.cible;
        return { slots, problem: problemFrom(res, "enregistrement") };
      }
      slots.cible = H.recordRef(res.match.type, res.match.record);
    }
    if (isRef(slots.cible) && slots.cible.type === "clients") {
      const [inter, opps] = await Promise.all([
        storage.count("interactions", { client_id: slots.cible.id }),
        storage.count("opportunities", { client_id: slots.cible.id }),
      ]);
      slots._inter = inter;
      slots._opps = opps;
    }
    return { slots };
  },
  summary(s) {
    const lines = [`ATTENTION : supprimer definitivement ${TYPE_ARTICLE[s.cible.type]} ${s.cible.nom} ?`];
    if (s.cible.type === "clients") {
      if (s._inter) lines.push(`- ${s._inter} interaction(s) liee(s) seront aussi supprimee(s).`);
      if (s._opps) lines.push(`- ${s._opps} opportunite(s) seront conservee(s) mais detachee(s) du client.`);
    }
    lines.push("Cette action est irreversible.");
    return lines.join("\n");
  },
  async execute(s) {
    const removed = await storage.remove(s.cible.type, s.cible.id);
    if (!removed) return { reply: "Cet enregistrement n'existe deja plus." };
    return { reply: `${s.cible.nom} a ete supprime.`, record: null, actions: [{ type: "refresh" }] };
  },
};

module.exports = {
  createClient,
  createProspect,
  createOpportunity,
  logInteraction,
  convertProspect: convertProspectAction,
  updateStatus,
  deleteRecord,
};
