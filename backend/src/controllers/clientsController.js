/**
 * controllers/clientsController.js - CRUD Clients
 */
const storage = require("../services/storageService");
const { v4: uuidv4 } = require("uuid");

/**
 * GET /api/clients?search=&page=&limit=&statut=
 */
exports.getAll = async (req, res) => {
  try {
    const { search, page = 1, limit = 20, statut } = req.query;
    const filters = {};
    if (statut) filters.statut = statut;

    const result = await storage.findAll("clients", {
      search,
      page: parseInt(page),
      limit: parseInt(limit),
      filters,
    });
    res.json(result);
  } catch (err) {
    console.error("clients.getAll:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * GET /api/clients/:id
 */
exports.getById = async (req, res) => {
  try {
    const client = await storage.findById("clients", req.params.id);
    if (!client) return res.status(404).json({ error: "Client introuvable" });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * POST /api/clients
 */
exports.create = async (req, res) => {
  try {
    const { nom, email, telephone, entreprise, statut, notes } = req.body;
    if (!nom || !email) {
      return res.status(400).json({ error: "nom et email sont requis" });
    }

    const client = await storage.create("clients", {
      id: uuidv4(),
      nom,
      email,
      telephone: telephone || "",
      entreprise: entreprise || "",
      statut: statut || "actif",
      notes: notes || "",
      source: "direct",
    });

    res.status(201).json(client);
  } catch (err) {
    console.error("clients.create:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * PUT /api/clients/:id
 */
exports.update = async (req, res) => {
  try {
    const { nom, email, telephone, entreprise, statut, notes } = req.body;
    const updated = await storage.update("clients", req.params.id, {
      ...(nom !== undefined && { nom }),
      ...(email !== undefined && { email }),
      ...(telephone !== undefined && { telephone }),
      ...(entreprise !== undefined && { entreprise }),
      ...(statut !== undefined && { statut }),
      ...(notes !== undefined && { notes }),
    });

    if (!updated) return res.status(404).json({ error: "Client introuvable" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * DELETE /api/clients/:id
 */
exports.remove = async (req, res) => {
  try {
    const removed = await storage.remove("clients", req.params.id);
    if (!removed) return res.status(404).json({ error: "Client introuvable" });
    res.json({ message: "Client supprimé", client: removed });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};
