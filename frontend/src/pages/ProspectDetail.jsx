/**
 * pages/ProspectDetail.jsx - Fiche prospect avec interactions
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import Modal from "../components/Modal";

export default function ProspectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prospect, setProspect] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [interModal, setInterModal] = useState(false);
  const [interForm, setInterForm] = useState({ type: "appel", sujet: "", contenu: "" });

  useEffect(() => {
    Promise.all([
      api.get(`/prospects/${id}`),
      api.get("/interactions", { params: { prospect_id: id, limit: 50 } }),
    ])
      .then(([pRes, iRes]) => {
        setProspect(pRes.data);
        setInteractions(iRes.data.data || []);
      })
      .catch(() => {
        toast.error("Prospect introuvable");
        navigate("/prospects");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleConvert = async () => {
    try {
      await api.post(`/prospects/${id}/convert`);
      toast.success("Prospect converti en client ! 🎉");
      navigate("/clients");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erreur conversion");
    }
  };

  const handleAddInteraction = async (e) => {
    e.preventDefault();
    try {
      await api.post("/interactions", {
        prospect_id: id,
        ...interForm,
        date: new Date().toISOString(),
      });
      toast.success("Interaction ajoutée");
      setInterModal(false);
      setInterForm({ type: "appel", sujet: "", contenu: "" });
      const res = await api.get("/interactions", { params: { prospect_id: id, limit: 50 } });
      setInteractions(res.data.data || []);
    } catch {
      toast.error("Erreur");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!prospect) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={() => navigate("/prospects")}
        className="text-sm text-gray-500 hover:text-gray-700 transition"
      >
        ← Retour aux prospects
      </button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-2xl font-bold">
            {prospect.nom[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{prospect.nom}</h1>
            <p className="text-gray-500 text-sm">{prospect.entreprise || "Aucune entreprise"}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-3 py-1 rounded-full font-medium ${
                prospect.statut === "nouveau"
                  ? "bg-blue-100 text-blue-700"
                  : prospect.statut === "contacte"
                  ? "bg-amber-100 text-amber-700"
                  : prospect.statut === "converti"
                  ? "bg-green-100 text-green-700"
                  : "bg-purple-100 text-purple-700"
              }`}
            >
              {prospect.statut}
            </span>
            {prospect.statut !== "converti" && (
              <button
                onClick={handleConvert}
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition"
              >
                Convertir en client →
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Email</p>
            <p className="font-medium text-gray-700">{prospect.email || "-"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Téléphone</p>
            <p className="font-medium text-gray-700">{prospect.telephone || "-"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Source</p>
            <p className="font-medium text-gray-700 capitalize">{prospect.source || "-"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Créé le</p>
            <p className="font-medium text-gray-700">
              {new Date(prospect.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>
        {prospect.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{prospect.notes}</p>
          </div>
        )}
      </div>

      {/* Interactions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            💬 Interactions ({interactions.length})
          </h2>
          <button
            onClick={() => setInterModal(true)}
            className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium transition"
          >
            + Ajouter
          </button>
        </div>
        {interactions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Aucune interaction enregistrée</p>
        ) : (
          <div className="space-y-3">
            {interactions.map((i) => (
              <div key={i.id} className="flex gap-3 p-3 rounded-lg bg-gray-50">
                <span className="text-lg">
                  {i.type === "appel" ? "📞" : i.type === "email" ? "📧" : i.type === "reunion" ? "🤝" : "📝"}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{i.sujet}</p>
                  {i.contenu && <p className="text-xs text-gray-500 mt-1">{i.contenu}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(i.date || i.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={interModal} onClose={() => setInterModal(false)} title="Nouvelle interaction">
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
            <button type="button" onClick={() => setInterModal(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg">
              Annuler
            </button>
            <button type="submit" className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg">
              Ajouter
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
