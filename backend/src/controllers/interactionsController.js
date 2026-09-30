/**
 * controllers/interactionsController.js - Interactions (appels, emails, notes)
 */
const storage = require("../services/storageService");
const { v4: uuidv4 } = require("uuid");

/**
 * GET /api/interactions?client_id=&prospect_id=&type=&page=&limit=
 */
exports.getAll = async (req, res) => {
  try {
    const { client_id, prospect_id, type, page = 1, limit = 50, search } = req.query;
    const filters = {};
    if (client_id) filters.client_id = client_id;
    if (prospect_id) filters.prospect_id = prospect_id;
    if (type) filters.type = type;

    const result = await storage.findAll("interactions", {
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
 * GET /api/interactions/:id
 */
exports.getById = async (req, res) => {
  try {
    const item = await storage.findById("interactions", req.params.id);
    if (!item) return res.status(404).json({ error: "Interaction introuvable" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * POST /api/interactions
 */
exports.create = async (req, res) => {
  try {
    const { client_id, prospect_id, type, sujet, contenu, date } = req.body;

    if (!type || !sujet) {
      return res.status(400).json({ error: "type et sujet requis" });
    }
    if (!client_id && !prospect_id) {
      return res.status(400).json({ error: "client_id ou prospect_id requis" });
    }

    const interaction = await storage.create("interactions", {
      id: uuidv4(),
      client_id: client_id || null,
      prospect_id: prospect_id || null,
      type, // "appel" | "email" | "note" | "reunion"
      sujet,
      contenu: contenu || "",
      date: date || new Date().toISOString(),
    });

    res.status(201).json(interaction);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * PUT /api/interactions/:id
 */
exports.update = async (req, res) => {
  try {
    const fields = {};
    ["type", "sujet", "contenu", "date", "client_id", "prospect_id"].forEach((k) => {
      if (req.body[k] !== undefined) fields[k] = req.body[k];
    });

    const updated = await storage.update("interactions", req.params.id, fields);
    if (!updated) return res.status(404).json({ error: "Interaction introuvable" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * DELETE /api/interactions/:id
 */
exports.remove = async (req, res) => {
  try {
    const removed = await storage.remove("interactions", req.params.id);
    if (!removed) return res.status(404).json({ error: "Interaction introuvable" });
    res.json({ message: "Interaction supprimée" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};
