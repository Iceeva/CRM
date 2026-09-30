/**
 * controllers/opportunitiesController.js — Opportunités commerciales
 */
const storage = require("../services/storageService");
const { v4: uuidv4 } = require("uuid");

/**
 * GET /api/opportunities?client_id=&statut=&page=&limit=
 */
exports.getAll = async (req, res) => {
  try {
    const { client_id, statut, page = 1, limit = 20, search } = req.query;
    const filters = {};
    if (client_id) filters.client_id = client_id;
    if (statut) filters.statut = statut;

    const result = await storage.findAll("opportunities", {
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
 * GET /api/opportunities/:id
 */
exports.getById = async (req, res) => {
  try {
    const item = await storage.findById("opportunities", req.params.id);
    if (!item) return res.status(404).json({ error: "Opportunité introuvable" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * POST /api/opportunities
 */
exports.create = async (req, res) => {
  try {
    const { client_id, titre, montant, statut, description, date_cloture } = req.body;

    if (!titre) {
      return res.status(400).json({ error: "titre requis" });
    }

    const opp = await storage.create("opportunities", {
      id: uuidv4(),
      client_id: client_id || null,
      titre,
      montant: parseFloat(montant) || 0,
      statut: statut || "prospection", // prospection | qualification | proposition | negociation | gagnee | perdue
      description: description || "",
      date_cloture: date_cloture || null,
    });

    res.status(201).json(opp);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * PUT /api/opportunities/:id
 */
exports.update = async (req, res) => {
  try {
    const fields = {};
    ["client_id", "titre", "montant", "statut", "description", "date_cloture"].forEach((k) => {
      if (req.body[k] !== undefined) {
        fields[k] = k === "montant" ? parseFloat(req.body[k]) || 0 : req.body[k];
      }
    });

    const updated = await storage.update("opportunities", req.params.id, fields);
    if (!updated) return res.status(404).json({ error: "Opportunité introuvable" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * DELETE /api/opportunities/:id
 */
exports.remove = async (req, res) => {
  try {
    const removed = await storage.remove("opportunities", req.params.id);
    if (!removed) return res.status(404).json({ error: "Opportunité introuvable" });
    res.json({ message: "Opportunité supprimée" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};
