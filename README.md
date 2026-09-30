# 🏢 CRM Pro — Application de Gestion Relation Client

## 📋 Description

CRM professionnel complet permettant de gérer les clients, prospects, interactions et opportunités commerciales. Interface moderne et responsive avec basculement automatique PostgreSQL ↔ JSON.

## 🧱 Stack technique

| Couche    | Technologie                          |
|-----------|--------------------------------------|
| Frontend  | React 18 + TailwindCSS + Recharts    |
| Backend   | Node.js + Express                    |
| BDD       | PostgreSQL (principal) / JSON (fallback) |
| Auth      | JWT (bcryptjs)                       |

---

## 🚀 Installation

### Prérequis
- Node.js v18+
- npm
- PostgreSQL (optionnel — le mode JSON fonctionne sans)

### 1. Backend

```bash
cd backend
cp .env.example .env      # Configurer les variables
npm install
node init-data.js          # Initialiser le compte admin (hash)
npm run dev                # Démarre sur http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm start                  # Démarre sur http://localhost:3000
```

### 3. PostgreSQL (optionnel)

```bash
createdb crm_db
psql -U postgres -d crm_db -f backend/schema.sql
# OU
cd backend && node src/scripts/initDb.js
```

---

## 🔑 Compte de démo

| Email          | Mot de passe | Rôle  |
|----------------|-------------|-------|
| admin@crm.com  | admin123    | admin |

Vous pouvez aussi créer un compte via la page d'inscription.

---

## 📦 Structure du projet

```
crm/
├── backend/
│   ├── src/
│   │   ├── server.js              # Point d'entrée
│   │   ├── config/
│   │   │   ├── db.js              # Connexion PostgreSQL
│   │   │   └── jsonStore.js       # Lecture/écriture JSON
│   │   ├── services/
│   │   │   └── storageService.js  # Abstraction PG / JSON
│   │   ├── middlewares/
│   │   │   ├── auth.js            # JWT
│   │   │   └── validate.js        # Validation
│   │   ├── controllers/           # Logique métier
│   │   ├── routes/                # Routes API
│   │   └── scripts/
│   │       └── initDb.js          # Init PostgreSQL
│   ├── data/
│   │   └── data.json              # Données JSON (fallback)
│   ├── schema.sql                 # Schema PostgreSQL
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Routeur principal
│   │   ├── context/
│   │   │   └── AuthContext.js     # Authentification
│   │   ├── hooks/
│   │   │   └── useStorageStatus.js # Détection PG/JSON
│   │   ├── services/
│   │   │   └── api.js             # Instance Axios
│   │   ├── components/            # Composants réutilisables
│   │   └── pages/                 # Pages de l'application
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

---

## 🔄 Logique de basculement PG ↔ JSON

1. Au démarrage, le backend tente de se connecter à PostgreSQL
2. **Si succès** → toutes les données passent par PostgreSQL
3. **Si échec** → bascule automatique vers `data/data.json`
4. Un health check toutes les 30s vérifie si PostgreSQL redevient disponible
5. Le frontend affiche un **toast** indiquant le mode actuel

---

## ✨ Fonctionnalités

- ✅ CRUD complet Clients (nom, email, téléphone, entreprise, statut)
- ✅ CRUD complet Prospects + conversion prospect → client
- ✅ Interactions (appels, emails, réunions, notes)
- ✅ Opportunités commerciales avec pipeline de vente
- ✅ Tableau de bord avec statistiques et graphiques
- ✅ Authentification JWT (login / register)
- ✅ Pagination sur toutes les listes
- ✅ Recherche et filtres en temps réel
- ✅ Notification toast PostgreSQL/JSON
- ✅ UI moderne et responsive (Tailwind CSS)
- ✅ Code propre, modulaire, commenté

---

## 🔗 API Endpoints

| Méthode | Route                        | Description              |
|---------|------------------------------|--------------------------|
| POST    | /api/auth/register           | Inscription              |
| POST    | /api/auth/login              | Connexion                |
| GET     | /api/auth/me                 | Profil connecté          |
| GET     | /api/clients                 | Liste clients            |
| POST    | /api/clients                 | Créer client             |
| PUT     | /api/clients/:id             | Modifier client          |
| DELETE  | /api/clients/:id             | Supprimer client         |
| GET     | /api/prospects               | Liste prospects          |
| POST    | /api/prospects/:id/convert   | Convertir → client       |
| GET     | /api/interactions            | Liste interactions       |
| GET     | /api/opportunities           | Liste opportunités       |
| GET     | /api/dashboard/stats         | Statistiques             |
| GET     | /api/dashboard/status        | Mode stockage actuel     |
| GET     | /api/health                  | Health check             |
