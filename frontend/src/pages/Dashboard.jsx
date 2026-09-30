/**
 * pages/Dashboard.jsx — Tableau de bord avec statistiques
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard/stats")
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-gray-500">Impossible de charger les statistiques.</p>;
  }

  const kpiCards = [
    { label: "Clients", value: stats.totalClients, icon: "👥", color: "bg-blue-50 text-blue-700", link: "/clients" },
    { label: "Prospects", value: stats.totalProspects, icon: "🎯", color: "bg-green-50 text-green-700", link: "/prospects" },
    { label: "Opportunités", value: stats.totalOpportunities, icon: "💰", color: "bg-amber-50 text-amber-700", link: "/opportunities" },
    { label: "Interactions", value: stats.totalInteractions, icon: "💬", color: "bg-purple-50 text-purple-700", link: "/interactions" },
    { label: "CA Gagné", value: `${(stats.totalRevenue || 0).toLocaleString("fr-FR")} €`, icon: "📈", color: "bg-emerald-50 text-emerald-700" },
    { label: "Opp. en cours", value: stats.oppEnCours, icon: "⏳", color: "bg-orange-50 text-orange-700" },
  ];

  const prospectPieData = [
    { name: "Nouveaux", value: stats.prospectsNouveaux },
    { name: "Contactés", value: stats.prospectsContactes },
    { name: "Convertis", value: stats.prospectsConvertis },
  ].filter((d) => d.value > 0);

  const oppBarData = [
    { name: "Gagnées", value: stats.oppGagnees },
    { name: "En négo.", value: stats.oppEnCours },
    { name: "Perdues", value: stats.oppPerdues },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-1">Vue d'ensemble de votre activité CRM</p>
      </div>

      {/* Storage badge */}
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          stats.storageMode === "postgresql"
            ? "bg-green-100 text-green-700"
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {stats.storageMode === "postgresql" ? "🐘 PostgreSQL" : "📄 JSON (mode local)"}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => {
          const Card = (
            <div
              key={kpi.label}
              className={`${kpi.color} rounded-xl p-4 transition hover:shadow-md`}
            >
              <div className="text-2xl mb-2">{kpi.icon}</div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs font-medium opacity-80 mt-1">{kpi.label}</p>
            </div>
          );
          return kpi.link ? (
            <Link key={kpi.label} to={kpi.link}>
              {Card}
            </Link>
          ) : (
            <div key={kpi.label}>{Card}</div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Prospects Pie */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Répartition des prospects</h3>
          {prospectPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={prospectPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {prospectPieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm text-center py-10">Aucun prospect</p>
          )}
        </div>

        {/* Opportunities Bar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Opportunités par statut</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={oppBarData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {oppBarData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Derniers prospects */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Derniers prospects</h3>
            <Link to="/prospects" className="text-xs text-primary-600 hover:underline">
              Voir tout →
            </Link>
          </div>
          {stats.recentProspects?.length > 0 ? (
            <div className="space-y-3">
              {stats.recentProspects.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                    {(p.nom || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.nom}</p>
                    <p className="text-xs text-gray-400 truncate">{p.entreprise || p.email}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.statut === "nouveau"
                        ? "bg-blue-100 text-blue-700"
                        : p.statut === "contacte"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {p.statut}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-6">Aucun prospect récent</p>
          )}
        </div>

        {/* Dernières interactions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Dernières interactions</h3>
            <Link to="/interactions" className="text-xs text-primary-600 hover:underline">
              Voir tout →
            </Link>
          </div>
          {stats.recentInteractions?.length > 0 ? (
            <div className="space-y-3">
              {stats.recentInteractions.map((i) => (
                <div key={i.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <span className="text-lg">
                    {i.type === "appel" ? "📞" : i.type === "email" ? "📧" : i.type === "reunion" ? "🤝" : "📝"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{i.sujet}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(i.date || i.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{i.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-6">Aucune interaction récente</p>
          )}
        </div>
      </div>
    </div>
  );
}
