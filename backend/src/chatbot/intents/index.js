/**
 * chatbot/intents/index.js - Catalogue complet des intentions
 * ----------------------------------------------------------------------------
 * Assemble les intentions sociales, de lecture et d'ecriture, et declare les
 * groupes d'intentions "confondables" pour lesquels le moteur pose une question
 * de desambiguisation quand deux intentions sont tres proches.
 *
 * COMMENT AJOUTER UNE INTENTION
 *   1. Ajouter un objet dans social.js, read.js ou write.js (voir le format dans social.js)
 *   2. Ecrire le handler correspondant dans handlers/ et l'enregistrer dans handlers/index.js
 *   3. Ajouter quelques phrases de test dans backend/test/chatbot.intents.test.js
 *   4. Aucun re-entrainement : le classifieur se reconstruit au chargement du module
 */
const social = require("./social");
const read = require("./read");
const write = require("./write");

const INTENTS = [...social, ...read, ...write];

/**
 * Groupes d'intentions proches. Si les deux meilleures intentions sont dans le
 * meme groupe et que leur ecart est faible, le moteur demande de choisir.
 * `label` est affiche dans les reponses rapides.
 */
const CONFUSABLE_GROUPS = [
  {
    ids: ["create_client", "create_prospect", "create_opportunity"],
    question: "Que souhaitez-vous creer exactement ?",
    labels: { create_client: "Un client", create_prospect: "Un prospect", create_opportunity: "Une opportunite" },
  },
  {
    ids: ["record_details", "get_contact_info", "find_record", "interaction_history"],
    question: "Que voulez-vous savoir exactement ?",
    labels: {
      record_details: "Voir la fiche complete",
      get_contact_info: "Voir les coordonnees",
      find_record: "Rechercher dans la base",
      interaction_history: "Voir l'historique des echanges",
    },
  },
  {
    ids: ["revenue_total", "pipeline_overview", "top_opportunities"],
    question: "Quelle information financiere souhaitez-vous ?",
    labels: {
      revenue_total: "Le chiffre d'affaires gagne",
      pipeline_overview: "La valeur du pipeline",
      top_opportunities: "Les plus grosses opportunites",
    },
  },
  {
    ids: ["count_records", "list_records"],
    question: "Voulez-vous le nombre ou la liste ?",
    labels: { count_records: "Le nombre", list_records: "La liste" },
  },
];

const BY_ID = Object.fromEntries(INTENTS.map((i) => [i.id, i]));

module.exports = { INTENTS, BY_ID, CONFUSABLE_GROUPS };
