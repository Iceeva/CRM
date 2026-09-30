/**
 * scripts/initDb.js - Crée les tables PostgreSQL + insère des données de démo
 * Usage : node src/scripts/initDb.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const schema = `
-- Utilisateurs (authentification)
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(64) PRIMARY KEY,
  nom           VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password      VARCHAR(255) NOT NULL,
  role          VARCHAR(50) DEFAULT 'user',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id            VARCHAR(64) PRIMARY KEY,
  nom           VARCHAR(255) NOT NULL,
  email         VARCHAR(255),
  telephone     VARCHAR(50),
  entreprise    VARCHAR(255),
  statut        VARCHAR(50) DEFAULT 'actif',
  notes         TEXT,
  source        VARCHAR(100),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Prospects
CREATE TABLE IF NOT EXISTS prospects (
  id            VARCHAR(64) PRIMARY KEY,
  nom           VARCHAR(255) NOT NULL,
  email         VARCHAR(255),
  telephone     VARCHAR(50),
  entreprise    VARCHAR(255),
  source        VARCHAR(100) DEFAULT 'site_web',
  statut        VARCHAR(50) DEFAULT 'nouveau',
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Interactions
CREATE TABLE IF NOT EXISTS interactions (
  id            VARCHAR(64) PRIMARY KEY,
  client_id     VARCHAR(64),
  prospect_id   VARCHAR(64),
  type          VARCHAR(50) NOT NULL,
  sujet         VARCHAR(500) NOT NULL,
  contenu       TEXT,
  date          TIMESTAMP DEFAULT NOW(),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Opportunités commerciales
CREATE TABLE IF NOT EXISTS opportunities (
  id            VARCHAR(64) PRIMARY KEY,
  client_id     VARCHAR(64),
  titre         VARCHAR(500) NOT NULL,
  montant       DECIMAL(15,2) DEFAULT 0,
  statut        VARCHAR(50) DEFAULT 'prospection',
  description   TEXT,
  date_cloture  DATE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
`;

async function run() {
  console.log("🔧  Création des tables...");
  await pool.query(schema);
  console.log("✅  Tables créées");

  // Utilisateur admin
  const hash = await bcrypt.hash("admin123", 10);
  const adminId = uuidv4();

  await pool.query(
    `INSERT INTO users (id, nom, email, password, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING`,
    [adminId, "Administrateur", "admin@crm.com", hash, "admin"]
  );
  console.log("👤  Admin : admin@crm.com / admin123");

  // Données de démo
  const clients = [
    { nom: "Marie Dupont", email: "marie@acme.com", telephone: "+33 6 12 34 56 78", entreprise: "ACME Corp", statut: "actif" },
    { nom: "Jean Martin", email: "jean@techfr.com", telephone: "+33 6 98 76 54 32", entreprise: "TechFR", statut: "actif" },
    { nom: "Sophie Laurent", email: "sophie@innov.io", telephone: "+33 7 11 22 33 44", entreprise: "Innov.io", statut: "inactif" },
  ];

  for (const c of clients) {
    await pool.query(
      `INSERT INTO clients (id, nom, email, telephone, entreprise, statut, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [uuidv4(), c.nom, c.email, c.telephone, c.entreprise, c.statut, "demo"]
    );
  }
  console.log(`📇  ${clients.length} clients de démo insérés`);

  const prospects = [
    { nom: "Pierre Durand", email: "pierre@startup.fr", entreprise: "StartupFR", source: "linkedin" },
    { nom: "Amina Diallo", email: "amina@consulting.sn", entreprise: "DialloCons", source: "salon" },
  ];

  for (const p of prospects) {
    await pool.query(
      `INSERT INTO prospects (id, nom, email, entreprise, source, statut)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [uuidv4(), p.nom, p.email, p.entreprise, p.source, "nouveau"]
    );
  }
  console.log(`🎯  ${prospects.length} prospects de démo insérés`);

  await pool.end();
  console.log("\n✅  Base initialisée avec succès !");
}

run().catch((err) => {
  console.error("❌  Erreur :", err.message);
  process.exit(1);
});
