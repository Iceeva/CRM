/**
 * app.js - Application Express (sans demarrage de serveur)
 * ----------------------------------------------------------------------------
 * Ce module EXPORTE l'application. Il est utilise :
 *   - en local par src/server.js (app.listen)
 *   - sur Vercel par api/index.js (fonction serverless)
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { env } = require("./config/env");
const storage = require("./services/storageService");
const { securityHeaders, requestId } = require("./middlewares/security");
const { notFound, errorHandler } = require("./middlewares/errorHandler");
const { rateLimit } = require("./middlewares/rateLimit");

const app = express();

app.disable("x-powered-by");
if (env.IS_PRODUCTION) app.set("trust proxy", 1); // IP reelle derriere le proxy Vercel

// ---- Middlewares globaux ----
app.use(requestId);
app.use(securityHeaders);
app.use(
  cors({
    origin(origin, cb) {
      // Requetes sans en-tete Origin (curl, meme origine) : toujours autorisees
      if (!origin) return cb(null, true);
      if (env.CORS_ORIGINS.length) return cb(null, env.CORS_ORIGINS.includes(origin));
      return cb(null, !env.IS_PRODUCTION); // dev : tout est permis, prod : meme origine
    },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
if (env.NODE_ENV !== "test") app.use(morgan(env.IS_PRODUCTION ? "tiny" : "dev"));

// Plafond global raisonnable pour toute l'API
app.use("/api", rateLimit({ windowMs: 60_000, max: 300 }));

// ---- Routes API ----
app.use("/api/auth", require("./routes/auth"));
app.use("/api/clients", require("./routes/clients"));
app.use("/api/prospects", require("./routes/prospects"));
app.use("/api/interactions", require("./routes/interactions"));
app.use("/api/opportunities", require("./routes/opportunities"));
app.use("/api/dashboard", require("./routes/dashboard"));

// ---- Health check ----
app.get("/api/health", async (req, res) => {
  await storage.ping().catch(() => false);
  const db = storage.status();
  if (env.IS_PRODUCTION) delete db.lastError; // pas de detail technique en public
  res.json({
    status: "ok",
    version: require("../package.json").version,
    storageMode: storage.isPostgres() ? "postgresql" : "json",
    database: db,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ---- 404 propre pour toute route /api inconnue ----
app.use("/api", notFound);

// ---- Auto-hebergement : servir le frontend compile s'il existe ----
// (sur Vercel, les fichiers statiques sont servis par le CDN, pas par Express)
const buildDir = path.join(__dirname, "../../frontend/build");
if (!env.IS_VERCEL && fs.existsSync(path.join(buildDir, "index.html"))) {
  app.use(express.static(buildDir));
  app.get("*", (req, res) => res.sendFile(path.join(buildDir, "index.html")));
}

app.use(errorHandler);

module.exports = app;
