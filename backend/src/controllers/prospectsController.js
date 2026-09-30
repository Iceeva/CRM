/**
 * controllers/prospectsController.js - CRUD Prospects + conversion
 */
const storage = require("../services/storageService");
const { v4: uuidv4 } = require("uuid");

/**
 * GET /api/prospects?search=&page=&limit=&statut=
 */
exports.getAll = async (req, res) => {
  try {
    const { search, page = 1, limit = 20, statut } = req.query;
    const filters = {};
    if (statut) filters.statut = statut;

    const result = await storage.findAll("prospects", {
      search,
      page: parseInt(page),
      limit: parseInt(limit),
      filters,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * GET /api/prospects/:id
 */
exports.getById = async (req, res) => {
  try {
    const prospect = await storage.findById("prospects", req.params.id);
    if (!prospect) return res.status(404).json({ error: "Prospect introuvable" });
    res.json(prospect);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * POST /api/prospects
 */
exports.create = async (req, res) => {
  try {
    const { nom, email, telephone, entreprise, source, notes } = req.body;
    if (!nom || !email) {
      return res.status(400).json({ error: "nom et email sont requis" });
    }

    const prospect = await storage.create("prospects", {
      id: uuidv4(),
      nom,
      email,
      telephone: telephone || "",
      entreprise: entreprise || "",
      source: source || "site_web",
      statut: "nouveau",
      notes: notes || "",
    });

    res.status(201).json(prospect);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * PUT /api/prospects/:id
 */
exports.update = async (req, res) => {
  try {
    const fields = {};
    ["nom", "email", "telephone", "entreprise", "source", "statut", "notes"].forEach((k) => {
      if (req.body[k] !== undefined) fields[k] = req.body[k];
    });

    const updated = await storage.update("prospects", req.params.id, fields);
    if (!updated) return res.status(404).json({ error: "Prospect introuvable" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * DELETE /api/prospects/:id
 */
exports.remove = async (req, res) => {
  try {
    const removed = await storage.remove("prospects", req.params.id);
    if (!removed) return res.status(404).json({ error: "Prospect introuvable" });
    res.json({ message: "Prospect supprimé", prospect: removed });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * POST /api/prospects/:id/convert  - Convertir un prospect en client
 */
exports.convert = async (req, res) => {
  try {
    const prospect = await storage.findById("prospects", req.params.id);
    if (!prospect) return res.status(404).json({ error: "Prospect introuvable" });

    // Créer le client à partir du prospect
    const client = await storage.create("clients", {
      id: uuidv4(),
      nom: prospect.nom,
      email: prospect.email,
      telephone: prospect.telephone || "",
      entreprise: prospect.entreprise || "",
      statut: "actif",
      notes: `Converti depuis prospect le ${new Date().toLocaleDateString("fr-FR")}. ${prospect.notes || ""}`,
      source: prospect.source || "prospect",
    });

    // Marquer le prospect comme converti
    await storage.update("prospects", prospect.id, { statut: "converti" });

    // Créer une interaction « conversion »
    await storage.create("interactions", {
      id: uuidv4(),
      client_id: client.id,
      prospect_id: prospect.id,
      type: "note",
      sujet: "Conversion prospect → client",
      contenu: `Le prospect ${prospect.nom} a été converti en client.`,
      date: new Date().toISOString(),
    });

    res.status(201).json({ message: "Prospect converti en client", client });
  } catch (err) {
    console.error("convert:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
