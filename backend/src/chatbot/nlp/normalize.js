/**
 * chatbot/nlp/normalize.js - Normalisation du texte utilisateur
 * ----------------------------------------------------------------------------
 * Transforme une phrase libre en texte "propre" exploitable par le moteur :
 *
 *   1. unification des apostrophes et guillemets typographiques
 *   2. mise en minuscules et suppression des accents (NFD)
 *   3. apostrophes remplacees par une espace  (l'email -> "l email", j'ai -> "j ai",
 *      d'affaires -> "d affaires"). Les patrons du catalogue sont ecrits dans cette forme.
 *   4. expansion de l'argot SMS et des abreviations  (stp, svp, bjr, mdp, opp...)
 *   5. suppression de la ponctuation (les chiffres, @ . + : / % sont conserves
 *      car ils portent des entites : email, telephone, date, montant)
 *   6. compactage des espaces
 *
 * IMPORTANT : l'extraction d'entites travaille sur le texte BRUT (les majuscules
 * servent a reperer les noms propres). Seule la classification utilise le texte
 * normalise.
 */

/** Supprime les accents : "reunion" == "réunion". */
function stripAccents(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Unifie apostrophes, guillemets et espaces speciaux. */
function normalizeTypography(s) {
  return s
    .replace(/[\u2018\u2019\u201B\u2032`\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB\u201E]/g, '"')
    .replace(/[\u00A0\u202F\u2009]/g, " ")
    .replace(/\u2026/g, "...")
    .replace(/[\u2013\u2014]/g, "-");
}

/**
 * Argot / abreviations -> forme standard.
 * Les cles sont comparees APRES minuscules + suppression des accents.
 */
const SLANG = {
  stp: "s il te plait",
  svp: "s il vous plait",
  stv: "s il te plait",
  bjr: "bonjour",
  bsr: "bonsoir",
  slt: "salut",
  cc: "coucou",
  coucou: "salut",
  hey: "salut",
  hello: "bonjour",
  yo: "salut",
  wesh: "salut",
  cv: "ca va",
  mrc: "merci",
  merci: "merci",
  thx: "merci",
  thanks: "merci",
  mdp: "mot de passe",
  pq: "pourquoi",
  pk: "pourquoi",
  pcq: "parce que",
  pr: "pour",
  tt: "tout",
  tte: "toute",
  tts: "toutes",
  tjs: "toujours",
  qd: "quand",
  qq: "quelque",
  qqch: "quelque chose",
  qqn: "quelqu un",
  ac: "avec",
  avc: "avec",
  ds: "dans",
  dc: "donc",
  cmt: "comment",
  comment: "comment",
  cb: "combien",
  combi1: "combien",
  bcp: "beaucoup",
  pls: "s il te plait",
  plz: "s il te plait",
  ok: "ok",
  okay: "ok",
  okk: "ok",
  dac: "d accord",
  dacc: "d accord",
  oui: "oui",
  ouais: "oui",
  ouai: "oui",
  yep: "oui",
  yes: "oui",
  yeah: "oui",
  nan: "non",
  nope: "non",
  no: "non",
  opp: "opportunite",
  opps: "opportunites",
  oppo: "opportunite",
  oppos: "opportunites",
  inter: "interaction",
  interac: "interaction",
  rdv: "rendez vous",
  rdvs: "rendez vous",
  dispo: "disponible",
  info: "information",
  infos: "informations",
  tel: "telephone",
  tlf: "telephone",
  num: "numero",
  nb: "nombre",
  nbr: "nombre",
  stat: "statistique",
  stats: "statistiques",
  clt: "client",
  clts: "clients",
  cli: "client",
  pros: "prospect",
  prosp: "prospect",
  rep: "reponse",
  qqs: "quelques",
  nv: "nouveau",
  nvx: "nouveaux",
  nvlle: "nouvelle",
  ajd: "aujourd hui",
  ajrd: "aujourd hui",
  auj: "aujourd hui",
  dem1: "demain",
  "2main": "demain",
  ca: "ca",
  mn: "maintenant",
  mnt: "maintenant",
  jsp: "je ne sais pas",
  jpp: "j en peux plus",
  nn: "non",
  pdt: "pendant",
  env: "environ",
  ex: "exemple",
  max: "maximum",
  min: "minimum",
  moy: "moyenne",
  tkt: "ne t inquiete pas",
};

/**
 * Normalise une phrase pour la classification.
 * @param {string} input texte brut
 * @returns {{ raw: string, clean: string, tokens: string[] }}
 */
function normalize(input) {
  const raw = String(input == null ? "" : input).trim();
  let s = normalizeTypography(raw).toLowerCase();
  s = stripAccents(s);

  // Apostrophes -> espace : "l'email" devient "l email" (voir l'en-tete du fichier)
  s = s.replace(/'/g, " ");

  // Ponctuation -> espace, en conservant : lettres, chiffres, @ . + : / % - et _
  s = s.replace(/[^a-z0-9@.+:/%_\-\s]/g, " ");
  // Les points / tirets / deux-points isoles (fins de phrase, listes) deviennent des espaces
  s = s.replace(/(^|\s)[.\-:/+_%]+(?=\s|$)/g, " ");
  s = s.replace(/[.:]+(?=\s|$)/g, " "); // "bonjour." "voici:" -> sans ponctuation finale
  s = s.replace(/-/g, " "); // "rendez-vous" -> "rendez vous", "peut-etre" -> "peut etre"
  s = s.replace(/\s+/g, " ").trim();

  // Expansion de l'argot, mot par mot
  const words = s.split(" ").filter(Boolean);
  const expanded = [];
  for (const w of words) {
    const rep = SLANG[w];
    if (rep && rep !== w) expanded.push(...rep.split(" "));
    else expanded.push(w);
  }
  const clean = expanded.join(" ");
  return { raw, clean, tokens: expanded };
}

module.exports = { normalize, stripAccents, normalizeTypography, SLANG };
