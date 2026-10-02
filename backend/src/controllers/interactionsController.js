/**
 * controllers/interactionsController.js - Interactions (appel, email, reunion, note)
 */
const storage = require("../services/storageService");
const { newId } = require("../utils/id");
const { pick, emptyToNull } = require("../utils/pick");
const { parsePagination } = require("../utils/pagination");
const { HttpError } = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");

const FIELDS = ["type", "sujet", "contenu", "date", "client_id", "prospect_id"];

/** GET /api/interactions?client_id=&prospect_id=&type=&search=&page=&limit= */
exports.getAll = asyncHandler(async (req, res) => {
  const { client_id, prospect_id, type, search } = req.query;
  const result = await storage.findAll("interactions", {
    search,
    ...parsePagination(req.query, { defaultLimit: 50 }),
    filters: { client_id, prospect_id, type },
  });
  res.json(result);
});

/** GET /api/interactions/:id */
exports.getById = asyncHandler(async (req, res) => {
  const item = await storage.findById("interactions", req.params.id);
  if (!item) throw new HttpError(404, "Interaction introuvable");
  res.json(item);
});

/** POST /api/interactions */
exports.create = asyncHandler(async (req, res) => {
  const body = pick(req.body, FIELDS);
  const client_id = emptyToNull(body.client_id);
  const prospect_id = emptyToNull(body.prospect_id);

  if (!client_id && !prospect_id) {
    throw new HttpError(400, "client_id ou prospect_id requis");
  }

  const interaction = await storage.create("interactions", {
    id: newId(),
    contenu: "",
    ...body,
    client_id,
    prospect_id,
    date: body.date || new Date().toISOString(),
  });
  res.status(201).json(interaction);
});

/** PUT /api/interactions/:id */
exports.update = asyncHandler(async (req, res) => {
  const fields = pick(req.body, FIELDS);
  if ("client_id" in fields) fields.client_id = emptyToNull(fields.client_id);
  if ("prospect_id" in fields) fields.prospect_id = emptyToNull(fields.prospect_id);

  const updated = await storage.update("interactions", req.params.id, fields);
  if (!updated) throw new HttpError(404, "Interaction introuvable");
  res.json(updated);
});

/** DELETE /api/interactions/:id */
exports.remove = asyncHandler(async (req, res) => {
  const removed = await storage.remove("interactions", req.params.id);
  if (!removed) throw new HttpError(404, "Interaction introuvable");
  res.json({ message: "Interaction supprimee" });
});
