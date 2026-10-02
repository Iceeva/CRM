/**
 * controllers/opportunitiesController.js - Opportunites commerciales (pipeline)
 */
const storage = require("../services/storageService");
const { newId } = require("../utils/id");
const { pick, emptyToNull } = require("../utils/pick");
const { parsePagination } = require("../utils/pagination");
const { HttpError } = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");

const FIELDS = ["client_id", "titre", "montant", "statut", "description", "date_cloture"];

/** GET /api/opportunities?client_id=&statut=&search=&page=&limit= */
exports.getAll = asyncHandler(async (req, res) => {
  const { client_id, statut, search } = req.query;
  const result = await storage.findAll("opportunities", {
    search,
    ...parsePagination(req.query),
    filters: { client_id, statut },
  });
  res.json(result);
});

/** GET /api/opportunities/:id */
exports.getById = asyncHandler(async (req, res) => {
  const item = await storage.findById("opportunities", req.params.id);
  if (!item) throw new HttpError(404, "Opportunite introuvable");
  res.json(item);
});

/** POST /api/opportunities */
exports.create = asyncHandler(async (req, res) => {
  const body = pick(req.body, FIELDS);
  const opp = await storage.create("opportunities", {
    id: newId(),
    description: "",
    statut: "prospection",
    ...body,
    client_id: emptyToNull(body.client_id),
    montant: Number(body.montant) || 0,
    date_cloture: emptyToNull(body.date_cloture),
  });
  res.status(201).json(opp);
});

/** PUT /api/opportunities/:id */
exports.update = asyncHandler(async (req, res) => {
  const fields = pick(req.body, FIELDS);
  if ("client_id" in fields) fields.client_id = emptyToNull(fields.client_id);
  if ("date_cloture" in fields) fields.date_cloture = emptyToNull(fields.date_cloture);
  if ("montant" in fields) fields.montant = Number(fields.montant) || 0;

  const updated = await storage.update("opportunities", req.params.id, fields);
  if (!updated) throw new HttpError(404, "Opportunite introuvable");
  res.json(updated);
});

/** DELETE /api/opportunities/:id */
exports.remove = asyncHandler(async (req, res) => {
  const removed = await storage.remove("opportunities", req.params.id);
  if (!removed) throw new HttpError(404, "Opportunite introuvable");
  res.json({ message: "Opportunite supprimee" });
});
