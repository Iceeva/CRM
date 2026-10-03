/**
 * chatbot/engine/format.js - Mise en forme des reponses (francais)
 */
const LABELS = {
  clients: { singular: "client", plural: "clients", article: "le", feminine: false },
  prospects: { singular: "prospect", plural: "prospects", article: "le", feminine: false },
  opportunities: { singular: "opportunite", plural: "opportunites", article: "l'", feminine: true },
  interactions: { singular: "interaction", plural: "interactions", article: "l'", feminine: true },
};

const STATUT_LABELS = {
  actif: "actif",
  inactif: "inactif",
  nouveau: "nouveau",
  contacte: "contacte",
  converti: "converti",
  prospection: "en prospection",
  qualification: "en qualification",
  proposition: "en proposition",
  negociation: "en negociation",
  gagnee: "gagnee",
  perdue: "perdue",
  ouvertes: "ouverte",
};

const ROUTES = { clients: "/clients", prospects: "/prospects", opportunities: "/opportunities", interactions: "/interactions" };
const DETAIL_ROUTES = { clients: "/clients/", prospects: "/prospects/" };

function money(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }).replace(/\u202f|\u00a0/g, " ")} EUR`;
}

function dateFr(d) {
  if (!d) return "";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "" : x.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "1 client" / "3 clients" / "aucun client". */
function count(n, type) {
  const l = LABELS[type];
  if (!l) return `${n}`;
  if (n === 0) return `aucun${l.feminine ? "e" : ""} ${l.singular}`;
  return `${n} ${n > 1 ? l.plural : l.singular}`;
}

/** Accord de l'adjectif de statut selon le genre de la ressource et le nombre. */
function statutLabel(statut, type, plural = false) {
  let base = STATUT_LABELS[statut] || statut;
  const fem = LABELS[type] && LABELS[type].feminine;
  if (fem) {
    base = base
      .replace(/^gagnee$/, "gagnee").replace(/^perdue$/, "perdue");
  } else {
    base = base.replace(/^gagnee$/, "gagne").replace(/^perdue$/, "perdu");
  }
  if (plural && !/s$/.test(base) && !base.startsWith("en ")) base += "s";
  return base;
}

/** Libelle d'un enregistrement selon son type. */
function recordTitle(type, r) {
  if (type === "opportunities") return r.titre;
  if (type === "interactions") return r.sujet;
  return r.nom;
}

function recordSubtitle(type, r) {
  if (type === "clients" || type === "prospects") return [r.entreprise, r.email].filter(Boolean).join(" - ");
  if (type === "opportunities") return `${money(r.montant)}${r.date_cloture ? ` - cloture ${dateFr(r.date_cloture)}` : ""}`;
  if (type === "interactions") return `${r.type} - ${dateFr(r.date || r.created_at)}`;
  return "";
}

/** Element de liste cliquable pour le frontend. */
function toItem(type, r) {
  return {
    id: r.id,
    title: recordTitle(type, r),
    subtitle: recordSubtitle(type, r),
    badge: r.statut || r.type || undefined,
    to: DETAIL_ROUTES[type] ? DETAIL_ROUTES[type] + r.id : ROUTES[type],
  };
}

/** Texte "- element (details)" pour la reponse textuelle. */
function bulletList(type, records, max = 8) {
  const lines = records.slice(0, max).map((r) => {
    const sub = recordSubtitle(type, r);
    const badge = r.statut ? ` [${r.statut}]` : "";
    return `- ${recordTitle(type, r)}${badge}${sub ? " : " + sub : ""}`;
  });
  if (records.length > max) lines.push(`... et ${records.length - max} de plus`);
  return lines.join("\n");
}

function pick(arr, seed = Date.now()) {
  return arr[Math.abs(seed) % arr.length];
}

module.exports = { LABELS, STATUT_LABELS, ROUTES, money, dateFr, count, statutLabel, recordTitle, recordSubtitle, toItem, bulletList, pick };
