/**
 * server.js — Point d'entrée du backend CRM
 *
 * 1. Charge les variables d'environnement
 * 2. Tente la connexion PostgreSQL
 * 3. Si échec → active le mode JSON fallback
 * 4. Démarre Express
 */
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const { testConnection, startHealthCheck } = require("./config/db");

const app = express();

// ── Middlewares globaux ──
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ── Routes API ──
app.use("/api/auth", require("./routes/auth"));
app.use("/api/clients", require("./routes/clients"));
app.use("/api/prospects", require("./routes/prospects"));
app.use("/api/interactions", require("./routes/interactions"));
app.use("/api/opportunities", require("./routes/opportunities"));
app.use("/api/dashboard", require("./routes/dashboard"));

// ── Health check ──
app.get("/api/health", (req, res) => {
  const storage = require("./services/storageService");
  res.json({
    status: "ok",
    storageMode: storage.isPostgres() ? "postgresql" : "json",
    timestamp: new Date().toISOString(),
  });
});

// ── Servir le frontend en production ──
app.use(express.static(path.join(__dirname, "../../frontend/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/build/index.html"));
});

// ── Gestion d'erreur globale ──
app.use((err, req, res, next) => {
  console.error("❌ Erreur :", err.message);
  res.status(err.status || 500).json({
    error: err.message || "Erreur interne du serveur",
  });
});

// ── Démarrage ──
const PORT = process.env.PORT || 5000;

async function start() {
  console.log("──────────────────────────────────────────");
  console.log("  🏢  CRM Pro — Démarrage du serveur");
  console.log("──────────────────────────────────────────");

  // Tenter PostgreSQL
  const pgOk = await testConnection();

  if (pgOk) {
    console.log("📦  Mode stockage : PostgreSQL");
  } else {
    console.log("📦  Mode stockage : JSON (fallback)");
    console.log("   → Les données seront lues/écrites dans data/data.json");
  }

  // Vérifier périodiquement si PostgreSQL redevient disponible
  startHealthCheck(30000);

  app.listen(PORT, () => {
    console.log(`🚀  Serveur démarré sur http://localhost:${PORT}`);
    console.log("──────────────────────────────────────────\n");
  });
}

start().catch(console.error);
