/**
 * chatbot/handlers/social.js - Reponses conversationnelles
 */
const { pick } = require("../engine/format");

const SUGGESTIONS = ["Resume de mon activite", "Combien de clients actifs ?", "Quel est mon chiffre d'affaires ?", "Qui dois-je relancer ?"];

exports.greeting = ({ user, now }) => {
  const h = now.getHours();
  const hello = h >= 18 || h < 5 ? "Bonsoir" : "Bonjour";
  const first = user && user.nom ? ` ${String(user.nom).split(" ")[0]}` : "";
  return {
    reply: `${hello}${first} ! Je suis l'assistant de votre CRM. Je peux consulter vos clients, prospects et opportunites, enregistrer des interactions ou creer des fiches. Que souhaitez-vous faire ?`,
    quickReplies: SUGGESTIONS,
  };
};

exports.goodbye = ({ now }) => ({
  reply: pick(["A bientot ! Bonne continuation.", "Au revoir, a tres vite !", "Bonne fin de journee, je reste disponible si besoin."], now.getTime()),
});

exports.thanks = ({ now }) => ({
  reply: pick(["Avec plaisir !", "Je vous en prie. Autre chose ?", "De rien, n'hesitez pas si vous avez d'autres questions."], now.getTime()),
  quickReplies: ["Resume de mon activite", "Qui dois-je relancer ?"],
});

exports.howAreYou = () => ({
  reply: "Je fonctionne parfaitement, merci ! Et vous, que puis-je faire pour vous dans le CRM ?",
  quickReplies: SUGGESTIONS,
});

exports.identity = ({ aiProvider }) => ({
  reply:
    "Je suis l'assistant virtuel de CRM Pro. Mon moteur de reconnaissance d'intentions analyse vos phrases (fautes de frappe, dates, montants, noms) et agit directement sur vos donnees." +
    (aiProvider ? ` Pour les questions plus ouvertes, je peux m'appuyer sur ${aiProvider === "openai" ? "OpenAI" : "Anthropic"}.` : " Je fonctionne entierement en local, sans service externe."),
  quickReplies: ["Que sais-tu faire ?"],
});

exports.help = () => ({
  reply: [
    "Voici ce que je sais faire :",
    "",
    "**Consulter**",
    "- \"Combien de clients actifs ?\" / \"Liste des prospects nouveaux\"",
    "- \"Quel est l'email de Marie Dupont ?\" / \"Fiche de Koffi Adjovi\"",
    "- \"Chiffre d'affaires du mois dernier\" / \"Valeur du pipeline\"",
    "- \"Plus grosses opportunites\" / \"Quelles affaires sont en retard ?\"",
    "- \"Historique des echanges avec Fatou Sow\" / \"Qui dois-je relancer ?\"",
    "",
    "**Agir** (toujours avec confirmation)",
    "- \"Ajoute un client\" / \"Nouveau prospect Camille Moreau\"",
    "- \"Cree une opportunite de 15000 euros\"",
    "- \"J'ai appele Nadia Benali hier\"",
    "- \"Convertis Yves Hounkpatin en client\" / \"Passe l'opportunite Audit en gagnee\"",
    "",
    "Je comprends les fautes de frappe, les abreviations (CA, opps, rdv) et les periodes (cette semaine, le mois dernier, 12/10/2026).",
  ].join("\n"),
  quickReplies: SUGGESTIONS,
});

exports.offTopic = () => ({
  reply:
    "Cette question sort du cadre de votre CRM, et je prefere ne pas inventer une reponse. Je peux en revanche vous aider avec vos clients, prospects, opportunites et interactions.",
  quickReplies: SUGGESTIONS,
});
