/**
 * controllers/clientsController.js - CRUD Clients
 */
const storage = require("../services/storageService");
const { newId } = require("../utils/id");
const { pick } = require("../utils/pick");
const { parsePagination } = require("../utils/pagination");
const { HttpError } = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");

const FIELDS = ["nom", "email", "telephone", "entreprise", "statut", "notes"];

/** GET /api/clients?search=&page=&limit=&statut= */
exports.getAll = asyncHandler(async (req, res) => {
  const { search, statut } = req.query;
  const result = await storage.findAll("clients", {
    search,
    ...parsePagination(req.query),
    filters: { statut },
  });
  res.json(result);
});

/** GET /api/clients/:id */
exports.getById = asyncHandler(async (req, res) => {
  const client = await storage.findById("clients", req.params.id);
  if (!client) throw new HttpError(404, "Client introuvable");
  res.json(client);
});

/** POST /api/clients */
exports.create = asyncHandler(async (req, res) => {
  const client = await storage.create("clients", {
    id: newId(),
    telephone: "",
    entreprise: "",
    notes: "",
    statut: "actif",
    ...pick(req.body, FIELDS),
    source: "direct",
  });
  res.status(201).json(client);
});

/** PUT /api/clients/:id */
exports.update = asyncHandler(async (req, res) => {
  const updated = await storage.update("clients", req.params.id, pick(req.body, FIELDS));
  if (!updated) throw new HttpError(404, "Client introuvable");
  res.json(updated);
});

/** DELETE /api/clients/:id  (supprime aussi ses interactions, detache ses opportunites) */
exports.remove = asyncHandler(async (req, res) => {
  const removed = await storage.remove("clients", req.params.id);
  if (!removed) throw new HttpError(404, "Client introuvable");
  res.json({ message: "Client supprime", client: removed });
});
