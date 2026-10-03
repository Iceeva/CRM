/**
 * chatbot/intents/social.js - Intentions conversationnelles (salutations, aide, identite)
 * ----------------------------------------------------------------------------
 * Format d'une intention (voir intents/index.js pour la documentation complete) :
 *   id, category, description, handler,
 *   examples   : phrases d'entrainement (similarite lexicale ponderee par l'IDF)
 *   keywords   : { strong: [...], weak: [...] } mots-cles (racinises au chargement)
 *   patterns   : [{ re, w }] expressions regulieres sur le texte normalise
 *   rules      : regles d'ajustement selon les entites detectees
 */
module.exports = [
  {
    id: "greeting",
    category: "social",
    description: "Salutation d'ouverture",
    handler: "greeting",
    examples: [
      "bonjour", "salut", "bonsoir", "coucou", "hello", "hey", "bonjour claude", "salut toi",
      "bonjour a toi", "bonsoir tout le monde", "yo", "re bonjour",
    ],
    keywords: { strong: ["bonjour", "salut", "bonsoir", "coucou", "hello", "hey"], weak: [] },
    patterns: [{ re: /^(salut|bonjour|bonsoir|hello|hey|coucou|yo|wesh)\b/, w: 0.9 }],
    // "salut ca va ?" est d'abord une question sur l'etat de l'assistant
    rules: { maxTokens: 6, blockIfPattern: [/\bca va\b/, /\bcomment (vas|allez|va)\b/] },
  },
  {
    id: "goodbye",
    category: "social",
    description: "Prise de conge",
    handler: "goodbye",
    examples: [
      "au revoir", "a bientot", "a plus tard", "bye", "ciao", "bonne journee", "bonne soiree",
      "a demain", "je m en vais", "je te laisse", "bonne continuation", "a la prochaine", "adieu",
    ],
    keywords: { strong: ["revoir", "bientot", "bye", "ciao", "adieu"], weak: ["bonne journee", "bonne soiree", "demain"] },
    patterns: [
      { re: /\b(au revoir|a bientot|a plus|a la prochaine|bye|ciao|adieu)\b/, w: 0.9 },
      { re: /\bbonne (journee|soiree|continuation|nuit|fin de journee)\b/, w: 0.8 },
      { re: /\bje (te laisse|m en vais|file|y vais)\b/, w: 0.6 },
    ],
    rules: { maxTokens: 8, blockIfPattern: [/^(hello|salut|bonjour|bonsoir|coucou|hey)\b/] },
  },
  {
    id: "thanks",
    category: "social",
    description: "Remerciement ou compliment",
    handler: "thanks",
    examples: [
      "merci", "merci beaucoup", "super merci", "merci pour ton aide", "c est parfait", "genial",
      "excellent travail", "bravo", "top merci", "merci bien", "tres utile", "impeccable", "nickel",
    ],
    keywords: { strong: ["merci", "bravo", "genial", "impeccable", "nickel"], weak: ["parfait", "super", "top", "excellent", "utile"] },
    patterns: [
      { re: /\b(merci|remercie|thanks)\b/, w: 0.85 },
      { re: /\b(bravo|genial|impeccable|nickel|excellent travail|tres utile|c est parfait)\b/, w: 0.7 },
    ],
    rules: { maxTokens: 8 },
  },
  {
    id: "how_are_you",
    category: "social",
    description: "Question sur l'etat de l'assistant",
    handler: "howAreYou",
    examples: [
      "ca va", "comment vas tu", "comment allez vous", "tu vas bien", "comment ca va",
      "tu vas bien aujourd hui", "la forme", "quoi de beau", "comment tu te portes", "ca roule",
    ],
    keywords: { strong: [], weak: ["forme", "porter"] },
    patterns: [
      { re: /\b(comment (vas tu|va tu|allez vous|ca va|tu vas|tu te portes)|ca va( bien)?|tu vas bien|la forme)\b/, w: 0.9 },
      { re: /^ca roule\b/, w: 0.8 },
    ],
    rules: { maxTokens: 8, rejectEntities: ["entityType", "statut", "names"] },
  },
  {
    id: "bot_identity",
    category: "social",
    description: "Question sur l'identite de l'assistant",
    handler: "identity",
    examples: [
      "qui es tu", "tu es qui", "comment tu t appelles", "quel est ton nom", "tu es un robot",
      "tu es une ia", "qui t a cree", "presente toi", "c est quoi ton nom", "tu es humain",
      "tu es quoi exactement", "qui est tu", "a qui je parle",
    ],
    keywords: { strong: ["robot", "humain", "appelles", "presente"], weak: ["nom", "cree", "ia"] },
    patterns: [
      { re: /\b(qui es tu|tu es qui|qui est tu|a qui (je )?parle|comment tu t appelles|ton nom|presente toi)\b/, w: 0.9 },
      { re: /\btu es (un |une )?(robot|ia|humain|bot|assistant|intelligence artificielle|vrai)\b/, w: 0.85 },
      { re: /\bqui (t a|ta|vous a) (cree|developpe|programme|fait)\b/, w: 0.85 },
    ],
    rules: { maxTokens: 9, rejectEntities: ["entityType", "statut"] },
  },
  {
    id: "help",
    category: "social",
    description: "Demande d'aide ou de liste des capacites",
    handler: "help",
    examples: [
      "aide", "aide moi", "que peux tu faire", "qu est ce que tu sais faire", "quelles sont tes fonctionnalites",
      "comment ca marche", "exemples de commandes", "que puis je te demander", "comment t utiliser",
      "liste des commandes", "tes capacites", "j ai besoin d aide", "a quoi tu sers", "help",
      "montre moi ce que tu sais faire", "donne moi des exemples",
    ],
    keywords: { strong: ["aide", "aider", "help", "fonctionnalite", "capacite", "commande"], weak: ["exemple", "utiliser", "sers", "marche"] },
    patterns: [
      { re: /\b(que|qu est ce que|quoi) (peux|sais|puis)[ -]?(tu|je|vous)?\b.*\b(faire|demander|utiliser)\b/, w: 0.9 },
      { re: /^(aide|help|aidez moi|aide moi|a l aide)\b/, w: 0.9 },
      { re: /\b(quelles? (sont|est) (tes|vos|les) (fonctionnalites?|capacites?|commandes?|possibilites?))\b/, w: 0.9 },
      { re: /\b(a quoi tu sers|comment (ca marche|t utiliser|te parler|fonctionnes? tu)|exemples? de (commandes?|questions?|phrases?))\b/, w: 0.85 },
      { re: /\bj ai besoin d aide\b/, w: 0.85 },
    ],
    rules: { maxTokens: 12, rejectEntities: ["names", "amount"] },
  },
  {
    id: "off_topic",
    category: "social",
    description: "Question sans rapport avec le CRM (culture generale, calcul, divertissement...)",
    handler: "offTopic",
    examples: [
      "quelle est la capitale de la france", "raconte moi une blague", "quel temps fait il demain",
      "ecris un poeme sur la mer", "combien font 12 fois 13", "recommande moi un film", "donne moi une recette de cuisine",
      "traduis cette phrase en anglais", "qui a gagne la coupe du monde", "explique moi la relativite",
      "conseille moi un livre", "quelle heure est il", "resous cette equation", "ecris moi un mail de vacances",
    ],
    keywords: {
      strong: ["blague", "poeme", "recette", "film", "meteo", "capitale", "traduis", "equation", "horoscope", "musique", "chanson"],
      weak: ["livre", "temps", "heure", "histoire", "sport", "football"],
    },
    patterns: [
      { re: /(blague|poeme|recette|horoscope|meteo|chanson|film|serie)/, w: 0.85 },
      { re: /capitale (de|du|des|d)/, w: 0.9 },
      { re: /\bquel temps (fait|va)\b/, w: 0.9 },
      { re: /\bcombien (font|egale)\b/, w: 0.85 },
      { re: /\b\d+ (fois|x|plus|moins|divise par) \d+\b/, w: 0.85 },
      { re: /\b(traduis|traduire|traduction|ecris (moi )?(un|une)|redige (moi )?(un|une)|raconte( moi)?)\b/, w: 0.7 },
      { re: /\bqui a (gagne|invente|decouvert|ecrit|peint|cree)\b/, w: 0.85 },
      { re: /\b(explique( moi)?|c est quoi|qu est ce que c est)\b.*\b(relativite|physique|chimie|histoire|philosophie|politique|guerre)\b/, w: 0.85 },
      { re: /\bquelle heure\b/, w: 0.85 },
    ],
    rules: { rejectEntities: ["entityType", "statut", "field", "emails"] },
  },
];
