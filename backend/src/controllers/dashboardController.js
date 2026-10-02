/**
 * controllers/dashboardController.js - Statistiques du tableau de bord
 * ----------------------------------------------------------------------------
 * `computeStats()` est exportee pour etre reutilisee par le chatbot
 * (intentions "chiffre d'affaires", "resume", "pipeline"...).
 */
const storage = require("../services/storageService");
const { OPEN_OPPORTUNITY_STATUTS } = require("../constants");
const asyncHandler = require("../utils/asyncHandler");

async function computeStats() {
  const [
    totalClients,
    totalProspects,
    totalInteractions,
    totalOpportunities,
    oppByStatut,
    oppAmountByStatut,
    prospectsByStatut,
    clientsByStatut,
    recentInteractions,
    recentProspects,
  ] = await Promise.all([
    storage.count("clients"),
    storage.count("prospects"),
    storage.count("interactions"),
    storage.count("opportunities"),
    storage.groupCount("opportunities", "statut"),
    storage.groupSum("opportunities", "statut", "montant"),
    storage.groupCount("prospects", "statut"),
    storage.groupCount("clients", "statut"),
    storage.findAll("interactions", { limit: 5 }),
    storage.findAll("prospects", { limit: 5 }),
  ]);

  const g = (obj, k) => obj[k] || 0;
  const totalRevenue = g(oppAmountByStatut, "gagnee");
  const pipelineValue = OPEN_OPPORTUNITY_STATUTS.reduce((s, k) => s + g(oppAmountByStatut, k), 0);
  const conversionRate = totalProspects + g(prospectsByStatut, "converti") > 0
    ? Math.round((g(prospectsByStatut, "converti") / (totalProspects || 1)) * 1000) / 10
    : 0;

  return {
    totalClients,
    totalProspects,
    totalInteractions,
    totalOpportunities,
    oppGagnees: g(oppByStatut, "gagnee"),
    oppPerdues: g(oppByStatut, "perdue"),
    // Compatibilite frontend : "en cours" = etape de negociation
    oppEnCours: g(oppByStatut, "negociation"),
    oppOuvertes: OPEN_OPPORTUNITY_STATUTS.reduce((s, k) => s + g(oppByStatut, k), 0),
    prospectsNouveaux: g(prospectsByStatut, "nouveau"),
    prospectsContactes: g(prospectsByStatut, "contacte"),
    prospectsConvertis: g(prospectsByStatut, "converti"),
    totalRevenue,
    pipelineValue,
    conversionRate,
    oppByStatut,
    oppAmountByStatut,
    prospectsByStatut,
    clientsByStatut,
    recentInteractions: recentInteractions.data,
    recentProspects: recentProspects.data,
  };
}

/** GET /api/dashboard/stats */
exports.getStats = asyncHandler(async (req, res) => {
  const stats = await computeStats();
  res.json({
    ...stats,
    storageMode: storage.isPostgres() ? "postgresql" : "json",
  });
});

/** GET /api/dashboard/status - etat du stockage (appele par le frontend sans authentification) */
exports.getStatus = asyncHandler(async (req, res) => {
  await storage.ping().catch(() => false);
  res.json({
    storageMode: storage.isPostgres() ? "postgresql" : "json",
    database: storage.status(),
    timestamp: new Date().toISOString(),
  });
});

exports.computeStats = computeStats;
