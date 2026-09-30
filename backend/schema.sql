-- ══════════════════════════════════════════════════════════
--  CRM Pro — Schema PostgreSQL
--  Exécuter : psql -U postgres -d crm_db -f schema.sql
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(64) PRIMARY KEY,
  nom           VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password      VARCHAR(255) NOT NULL,
  role          VARCHAR(50) DEFAULT 'user',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

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

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_statut ON clients(statut);
CREATE INDEX IF NOT EXISTS idx_prospects_statut ON prospects(statut);
CREATE INDEX IF NOT EXISTS idx_interactions_client ON interactions(client_id);
CREATE INDEX IF NOT EXISTS idx_interactions_prospect ON interactions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_client ON opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_statut ON opportunities(statut);
