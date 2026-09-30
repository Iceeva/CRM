/**
 * pages/ClientDetail.jsx — Fiche client avec interactions et opportunités
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import Modal from "../components/Modal";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal interaction
  const [interModal, setInterModal] = useState(false);
  const [interForm, setInterForm] = useState({ type: "appel", sujet: "", contenu: "" });

  useEffect(() => {
    Promise.all([
      api.get(`/clients/${id}`),
      api.get("/interactions", { params: { client_id: id, limit: 50 } }),
      api.get("/opportunities", { params: { client_id: id, limit: 50 } }),
    ])
      .then(([cRes, iRes, oRes]) => {
        setClient(cRes.data);
        setInteractions(iRes.data.data || []);
        setOpportunities(oRes.data.data || []);
      })
      .catch(() => {
        toast.error("Client introuvable");
        navigate("/clients");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleAddInteraction = async (e) => {
    e.preventDefault();
    try {
      await api.post("/interactions", {
        client_id: id,
        ...interForm,
        date: new Date().toISOString(),
      });
      toast.success("Interaction ajoutée");
      setInterModal(false);
      setInterForm({ type: "appel", sujet: "", contenu: "" });
      // Refresh
      const res = await api.get("/interactions", { params: { client_id: id, limit: 50 } });
      setInteractions(res.data.data || []);
    } catch {
      toast.error("Erreur");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => navigate("/clients")}
        className="text-sm text-gray-500 hover:text-gray-700 transition"
      >
        ← Retour aux clients
      </button>

      {/* Client header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold">
            {client.nom[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{client.nom}</h1>
            <p className="text-gray-500 text-sm">{client.entreprise || "Aucune entreprise"}</p>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-medium ${
              client.statut === "actif"
                ? "bg-green-100 text-green-700"
                : client.statut === "vip"
                ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {client.statut}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Email</p>
            <p className="font-medium text-gray-700">{client.email || "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Téléphone</p>
            <p className="font-medium text-gray-700">{client.telephone || "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Depuis</p>
            <p className="font-medium text-gray-700">
              {new Date(client.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>
        {client.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{client.notes}</p>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Interactions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              💬 Interactions ({interactions.length})
            </h2>
            <button
              onClick={() => setInterModal(true)}
              className="text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1.5 rounded-lg font-medium transition"
            >
              + Ajouter
            </button>
          </div>
          {interactions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Aucune interaction</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {interactions.map((i) => (
                <div key={i.id} className="flex gap-3 p-3 rounded-lg bg-gray-50">
                  <span className="text-lg">
                    {i.type === "appel" ? "📞" : i.type === "email" ? "📧" : i.type === "reunion" ? "🤝" : "📝"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{i.sujet}</p>
                    {i.contenu && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{i.contenu}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(i.date || i.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opportunités */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            💰 Opportunités ({opportunities.length})
          </h2>
          {opportunities.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Aucune opportunité</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {opportunities.map((o) => (
                <div key={o.id} className="p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">{o.titre}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        o.statut === "gagnee"
                          ? "bg-green-100 text-green-700"
                          : o.statut === "perdue"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {o.statut}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {(parseFloat(o.montant) || 0).toLocaleString("fr-FR")} €
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add interaction modal */}
      <Modal
        isOpen={interModal}
        onClose={() => setInterModal(false)}
        title="Nouvelle interaction"
      >
        <form onSubmit={handleAddInteraction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={interForm.type}
              onChange={(e) => setInterForm({ ...interForm, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="appel">📞 Appel</option>
              <option value="email">📧 Email</option>
              <option value="reunion">🤝 Réunion</option>
              <option value="note">📝 Note</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sujet *</label>
            <input
              required
              value={interForm.sujet}
              onChange={(e) => setInterForm({ ...interForm, sujet: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenu</label>
            <textarea
              value={interForm.contenu}
              onChange={(e) => setInterForm({ ...interForm, contenu: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setInterModal(false)}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
            >
              Ajouter
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
