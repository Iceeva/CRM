/**
 * controllers/dashboardController.js - Statistiques pour le tableau de bord
 */
const storage = require("../services/storageService");

/**
 * GET /api/dashboard/stats
 */
exports.getStats = async (req, res) => {
  try {
    const [
      totalClients,
      totalProspects,
      totalInteractions,
      totalOpportunities,
      oppGagnees,
      oppPerdues,
      oppEnCours,
      prospectsNouveaux,
      prospectsContactes,
      prospectsConvertis,
    ] = await Promise.all([
      storage.count("clients"),
      storage.count("prospects"),
      storage.count("interactions"),
      storage.count("opportunities"),
      storage.count("opportunities", { statut: "gagnee" }),
      storage.count("opportunities", { statut: "perdue" }),
      storage.count("opportunities", { statut: "negociation" }),
      storage.count("prospects", { statut: "nouveau" }),
      storage.count("prospects", { statut: "contacte" }),
      storage.count("prospects", { statut: "converti" }),
    ]);

    // Calculer le montant total des opportunités gagnées
    const wonOpps = await storage.findAll("opportunities", {
      filters: { statut: "gagnee" },
      limit: 1000,
    });
    const totalRevenue = wonOpps.data.reduce((sum, o) => sum + (parseFloat(o.montant) || 0), 0);

    // Dernières interactions
    const recentInteractions = await storage.findAll("interactions", { limit: 5 });

    // Derniers prospects
    const recentProspects = await storage.findAll("prospects", { limit: 5 });

    res.json({
      totalClients,
      totalProspects,
      totalInteractions,
      totalOpportunities,
      oppGagnees,
      oppPerdues,
      oppEnCours,
      prospectsNouveaux,
      prospectsContactes,
      prospectsConvertis,
      totalRevenue,
      recentInteractions: recentInteractions.data,
      recentProspects: recentProspects.data,
      storageMode: storage.isPostgres() ? "postgresql" : "json",
    });
  } catch (err) {
    console.error("dashboard error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/**
 * GET /api/dashboard/status - État du stockage (pour le frontend)
 */
exports.getStatus = async (req, res) => {
  res.json({
    storageMode: storage.isPostgres() ? "postgresql" : "json",
    timestamp: new Date().toISOString(),
  });
};
