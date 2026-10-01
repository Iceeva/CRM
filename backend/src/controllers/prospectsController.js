/**
 * controllers/prospectsController.js - CRUD Prospects + conversion en client
 */
const storage = require("../services/storageService");
const { newId } = require("../utils/id");
const { pick } = require("../utils/pick");
const { parsePagination } = require("../utils/pagination");
const { HttpError } = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");

const FIELDS = ["nom", "email", "telephone", "entreprise", "source", "statut", "notes"];

/** GET /api/prospects?search=&page=&limit=&statut= */
exports.getAll = asyncHandler(async (req, res) => {
  const { search, statut } = req.query;
  const result = await storage.findAll("prospects", {
    search,
    ...parsePagination(req.query),
    filters: { statut },
  });
  res.json(result);
});

/** GET /api/prospects/:id */
exports.getById = asyncHandler(async (req, res) => {
  const prospect = await storage.findById("prospects", req.params.id);
  if (!prospect) throw new HttpError(404, "Prospect introuvable");
  res.json(prospect);
});

/** POST /api/prospects */
exports.create = asyncHandler(async (req, res) => {
  const prospect = await storage.create("prospects", {
    id: newId(),
    telephone: "",
    entreprise: "",
    notes: "",
    source: "site_web",
    ...pick(req.body, FIELDS),
    statut: "nouveau",
  });
  res.status(201).json(prospect);
});

/** PUT /api/prospects/:id */
exports.update = asyncHandler(async (req, res) => {
  const updated = await storage.update("prospects", req.params.id, pick(req.body, FIELDS));
  if (!updated) throw new HttpError(404, "Prospect introuvable");
  res.json(updated);
});

/** DELETE /api/prospects/:id */
exports.remove = asyncHandler(async (req, res) => {
  const removed = await storage.remove("prospects", req.params.id);
  if (!removed) throw new HttpError(404, "Prospect introuvable");
  res.json({ message: "Prospect supprime", prospect: removed });
});

/**
 * Convertit un prospect en client (reutilisee par le chatbot).
 * 1. cree le client  2. marque le prospect "converti"  3. journalise une interaction
 * @returns {Promise<{client: object, prospect: object}>}
 */
async function convertProspect(prospectId) {
  const prospect = await storage.findById("prospects", prospectId);
  if (!prospect) throw new HttpError(404, "Prospect introuvable");
  if (prospect.statut === "converti") throw new HttpError(409, "Ce prospect est deja converti en client");

  const client = await storage.create("clients", {
    id: newId(),
    nom: prospect.nom,
    email: prospect.email || "",
    telephone: prospect.telephone || "",
    entreprise: prospect.entreprise || "",
    statut: "actif",
    notes: `Converti depuis prospect le ${new Date().toLocaleDateString("fr-FR")}. ${prospect.notes || ""}`.trim(),
    source: prospect.source || "prospect",
  });

  const updated = await storage.update("prospects", prospect.id, { statut: "converti" });

  await storage.create("interactions", {
    id: newId(),
    client_id: client.id,
    prospect_id: prospect.id,
    type: "note",
    sujet: "Conversion prospect vers client",
    contenu: `Le prospect ${prospect.nom} a ete converti en client.`,
    date: new Date().toISOString(),
  });

  return { client, prospect: updated };
}
exports.convertProspect = convertProspect;

/** POST /api/prospects/:id/convert */
exports.convert = asyncHandler(async (req, res) => {
  const { client } = await convertProspect(req.params.id);
  res.status(201).json({ message: "Prospect converti en client", client });
});
