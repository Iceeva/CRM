/**
 * test/chatbot.intents.test.js - Evaluation du moteur de reconnaissance d'intentions
 * ----------------------------------------------------------------------------
 * Ces phrases NE FIGURENT PAS dans les exemples d'entrainement (intents/*.js) :
 * elles mesurent donc la capacite de generalisation du classifieur.
 *
 * Lancer :  npm test   (depuis backend/ ou la racine)
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { classify } = require("../src/chatbot/engine/classifier");

const NOW = new Date(2026, 9, 3);

// [phrase, intention attendue]
const CASES = [
  // --- social
  ["Bonjour !", "greeting"],
  ["Salut Claude", "greeting"],
  ["bsr", "greeting"],
  ["slt", "greeting"],
  ["Hello, bonne journée à toi", "greeting"],
  ["salut, ça va ?", "how_are_you"],
  ["Comment allez-vous aujourd'hui ?", "how_are_you"],
  ["tu vas bien ?", "how_are_you"],
  ["au revoir et à demain", "goodbye"],
  ["bye bye", "goodbye"],
  ["Je te laisse, à plus", "goodbye"],
  ["merci pour tout", "thanks"],
  ["mrc c'est top", "thanks"],
  ["Super, merci beaucoup !", "thanks"],
  ["tu es un robot ?", "bot_identity"],
  ["comment tu t'appelles ?", "bot_identity"],
  ["Qui es-tu exactement ?", "bot_identity"],
  ["Que sais-tu faire ?", "help"],
  ["j'ai besoin d'aide", "help"],
  ["Donne-moi des exemples de questions", "help"],
  ["aide", "help"],

  // --- statistiques et comptage
  ["Fais-moi un résumé de la situation", "stats_overview"],
  ["je voudrais un bilan", "stats_overview"],
  ["donne-moi les chiffres clés", "stats_overview"],
  ["ou en est-on ?", "stats_overview"],
  ["Combien de clients j'ai ?", "count_records"],
  ["nombre de prospects nouveaux", "count_records"],
  ["combien d'opportunités sont gagnées ?", "count_records"],
  ["combien de clients inactifs avons-nous", "count_records"],
  ["Combien de prospets ?", "count_records"],
  ["nbr de clts actifs", "count_records"],
  ["combien d'interactions ce mois-ci ?", "count_records"],

  // --- listes
  ["Montre-moi les clients actifs", "list_records"],
  ["affiche mes prospects", "list_records"],
  ["je veux voir les opportunités perdues", "list_records"],
  ["liste des clients inactifs", "list_records"],
  ["quels sont mes prospects contactés ?", "list_records"],
  ["donne-moi les 5 derniers clients", "list_records"],
  ["les opportunités de plus de 10k", "list_records"],
  ["affiche les cleints actifs", "list_records"],
  ["montre les opps en négociation", "list_records"],

  // --- recherche et fiches
  ["trouve Sophie Laurent", "find_record"],
  ["recherche l'entreprise Atlas Digital", "find_record"],
  ["est-ce que Koffi Adjovi est dans la base ?", "find_record"],
  ["cherche marie@acme.com", "find_record"],
  ["quel est le téléphone de Fatou Sow ?", "get_contact_info"],
  ["donne-moi l'email de Nadia Benali", "get_contact_info"],
  ["comment joindre Pierre Durand ?", "get_contact_info"],
  ["quelle est l'entreprise de Camille Moreau", "get_contact_info"],
  ["numéro de Lucas Bernard", "get_contact_info"],
  ["fiche de Jean Martin", "record_details"],
  ["parle-moi de Sophie Laurent", "record_details"],
  ["détails sur le client Koffi Adjovi", "record_details"],
  ["tout savoir sur Amina Diallo", "record_details"],

  // --- finances
  ["quel est mon chiffre d'affaires ?", "revenue_total"],
  ["CA du mois dernier", "revenue_total"],
  ["combien j'ai gagné cette année ?", "revenue_total"],
  ["total des ventes signées en septembre", "revenue_total"],
  ["mes revenus de la semaine", "revenue_total"],
  ["quel est l'état du pipeline ?", "pipeline_overview"],
  ["combien vaut mon pipeline ?", "pipeline_overview"],
  ["répartition des affaires par étape", "pipeline_overview"],
  ["prévisions de ventes", "pipeline_overview"],
  ["quelle est ma plus grosse affaire ?", "top_opportunities"],
  ["top 5 des deals", "top_opportunities"],
  ["classement des opportunités par montant", "top_opportunities"],
  ["quelles affaires arrivent à échéance ?", "closing_soon"],
  ["opportunités à clôturer cette semaine", "closing_soon"],
  ["y a-t-il des opportunités en retard ?", "closing_soon"],

  // --- activite
  ["Quoi de neuf ?", "recent_activity"],
  ["montre mes derniers appels", "recent_activity"],
  ["activité récente", "recent_activity"],
  ["qu'ai-je fait hier ?", "recent_activity"],
  ["quel est le taux de conversion ?", "conversion_rate"],
  ["quel pourcentage de prospects deviennent clients ?", "conversion_rate"],
  ["historique des échanges avec Nadia Benali", "interaction_history"],
  ["quand a-t-on contacté Fatou Sow pour la dernière fois ?", "interaction_history"],
  ["interactions avec Jean Martin", "interaction_history"],
  ["qui dois-je relancer ?", "followup_suggestions"],
  ["quels prospects faut-il recontacter", "followup_suggestions"],
  ["que dois-je faire aujourd'hui ?", "followup_suggestions"],
  ["mes priorités du jour", "followup_suggestions"],

  // --- systeme et navigation
  ["la base de données est-elle connectée ?", "storage_status"],
  ["tu utilises neon ou json ?", "storage_status"],
  ["quel est le mode de stockage", "storage_status"],
  ["ouvre la page des prospects", "navigate"],
  ["emmène-moi au tableau de bord", "navigate"],
  ["aller sur les opportunités", "navigate"],
  ["va à l'accueil", "navigate"],

  // --- ecriture
  ["ajoute un client", "create_client"],
  ["nouveau client Aïcha Bio chez Sahel Conseil", "create_client"],
  ["je veux créer un client", "create_client"],
  ["ajoute un prospect", "create_prospect"],
  ["enregistre un nouveau lead Yves Hounkpatin", "create_prospect"],
  ["crée un prospect Camille Moreau email camille@moreau.fr", "create_prospect"],
  ["crée une opportunité", "create_opportunity"],
  ["nouvelle affaire de 8000 euros", "create_opportunity"],
  ["ajoute un deal \"Refonte site\" de 12000 euros", "create_opportunity"],
  ["note un appel avec Fatou Sow", "log_interaction"],
  ["j'ai envoyé un mail à Nadia Benali ce matin", "log_interaction"],
  ["enregistre une réunion avec Koffi Adjovi", "log_interaction"],
  ["ajoute une note pour Sophie Laurent", "log_interaction"],
  ["j'ai eu un rendez-vous avec Jean Martin", "log_interaction"],
  ["convertis Camille Moreau en client", "convert_prospect"],
  ["transforme le prospect Yves Hounkpatin en client", "convert_prospect"],
  ["Ibrahim Traore est devenu client", "convert_prospect"],
  ["passe Sophie Laurent en inactif", "update_status"],
  ["marque l'opportunité Audit sécurité comme perdue", "update_status"],
  ["on a gagné le deal Atlas Digital", "update_status"],
  ["change le statut de Marie Dupont en actif", "update_status"],
  ["supprime le prospect Yves Hounkpatin", "delete_record"],
  ["efface le client Lucas Bernard", "delete_record"],
  ["je veux supprimer une opportunité", "delete_record"],
];

// Phrases hors sujet : intention off_topic, ou confiance sous le seuil
const OUT_OF_SCOPE = [
  "quelle est la capitale de la France ?",
  "raconte-moi une blague sur les chats",
  "blablabla xyz",
  "quel temps fait-il à Cotonou ?",
  "écris un poème sur la mer",
  "asdfgh qwerty",
  "combien font 12 fois 13 ?",
  "recommande-moi un bon film",
];

test("intentions : precision sur les phrases inedites", () => {
  const failures = [];
  for (const [text, expected] of CASES) {
    const r = classify(text, { now: NOW });
    if (r.intent !== expected) failures.push(`"${text}" -> ${r.intent} (attendu ${expected}, confiance ${r.confidence.toFixed(2)})`);
  }
  const accuracy = (CASES.length - failures.length) / CASES.length;
  console.log(`Precision : ${(accuracy * 100).toFixed(1)} % (${CASES.length - failures.length}/${CASES.length})`);
  if (failures.length) console.log("Erreurs :\n  " + failures.join("\n  "));
  assert.ok(accuracy >= 0.95, `precision trop basse : ${(accuracy * 100).toFixed(1)} %`);
});

test("hors sujet : detecte ou incertain (jamais pris pour une action du CRM)", () => {
  const bad = [];
  for (const text of OUT_OF_SCOPE) {
    const r = classify(text, { now: NOW });
    // Soit l'intention "off_topic" est reconnue, soit le moteur reste incertain
    if (r.intent !== "off_topic" && r.confidence >= 0.55) bad.push(`"${text}" -> ${r.intent} (${r.confidence.toFixed(2)})`);
  }
  if (bad.length) console.log("Faux positifs :\n  " + bad.join("\n  "));
  assert.equal(bad.length, 0, `faux positifs : ${bad.length}`);
});

test("confiance elevee sur les phrases claires", () => {
  const clear = ["Bonjour !", "combien de clients actifs ?", "supprime le client Lucas Bernard", "quel est mon chiffre d'affaires ?"];
  for (const text of clear) {
    const r = classify(text, { now: NOW });
    assert.ok(r.confidence >= 0.8, `"${text}" : confiance ${r.confidence.toFixed(2)}`);
  }
});

test("ambiguite : creation sans type de ressource", () => {
  const r = classify("ajoute Marie Curie", { now: NOW });
  assert.ok(["create_client", "create_prospect", "create_opportunity", "log_interaction"].includes(r.intent));
});
