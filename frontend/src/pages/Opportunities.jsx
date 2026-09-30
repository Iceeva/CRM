/**
 * pages/Opportunities.jsx - Gestion des opportunités commerciales
 */
import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import Modal from "../components/Modal";
import SearchBar from "../components/SearchBar";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";

const STATUTS = ["prospection", "qualification", "proposition", "negociation", "gagnee", "perdue"];

const STATUT_COLORS = {
  prospection: "bg-gray-100 text-gray-700",
  qualification: "bg-blue-100 text-blue-700",
  proposition: "bg-indigo-100 text-indigo-700",
  negociation: "bg-amber-100 text-amber-700",
  gagnee: "bg-green-100 text-green-700",
  perdue: "bg-red-100 text-red-700",
};

const emptyForm = {
  titre: "",
  client_id: "",
  montant: "",
  statut: "prospection",
  description: "",
  date_cloture: "",
};

export default function Opportunities() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15, search };
      if (filterStatut) params.statut = filterStatut;
      const [oppRes, cliRes] = await Promise.all([
        api.get("/opportunities", { params }),
        api.get("/clients", { params: { limit: 200 } }),
      ]);
      setItems(oppRes.data.data);
      setTotal(oppRes.data.total);
      setTotalPages(oppRes.data.totalPages);
      setClients(cliRes.data.data || []);
    } catch {
      toast.error("Erreur chargement");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatut]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatut]);

  const openCreate = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (o) => {
    setForm({
      titre: o.titre || "",
      client_id: o.client_id || "",
      montant: o.montant?.toString() || "",
      statut: o.statut || "prospection",
      description: o.description || "",
      date_cloture: o.date_cloture?.split("T")[0] || "",
    });
    setEditId(o.id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, montant: parseFloat(form.montant) || 0 };
      if (editId) {
        await api.put(`/opportunities/${editId}`, payload);
        toast.success("Opportunité modifiée");
      } else {
        await api.post("/opportunities", payload);
        toast.success("Opportunité créée");
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/opportunities/${deleteId}`);
      toast.success("Opportunité supprimée");
      fetchData();
    } catch {
      toast.error("Erreur suppression");
    }
  };

  const getClientName = (cid) => {
    const c = clients.find((cl) => cl.id === cid);
    return c ? c.nom : "-";
  };

  // Total montant affiché
  const totalMontant = items.reduce((s, o) => s + (parseFloat(o.montant) || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunités</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} opportunité{total > 1 ? "s" : ""} - Total :{" "}
            <span className="font-semibold text-gray-700">
              {totalMontant.toLocaleString("fr-FR")} €
            </span>
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-5 py-2.5 rounded-lg transition shadow-sm"
        >
          + Nouvelle opportunité
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher..." />
        </div>
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Cards layout */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💰</p>
            <p className="text-gray-500">Aucune opportunité trouvée</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {items.map((o) => (
              <div
                key={o.id}
                className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 line-clamp-1">{o.titre}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ml-2 ${STATUT_COLORS[o.statut] || ""}`}>
                    {o.statut}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {(parseFloat(o.montant) || 0).toLocaleString("fr-FR")} €
                </p>
                <p className="text-xs text-gray-400 mt-1">Client : {getClientName(o.client_id)}</p>
                {o.date_cloture && (
                  <p className="text-xs text-gray-400">
                    Clôture : {new Date(o.date_cloture).toLocaleDateString("fr-FR")}
                  </p>
                )}
                {o.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{o.description}</p>
                )}
                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-50">
                  <button onClick={() => openEdit(o)} className="text-xs text-primary-600">✏️ Modifier</button>
                  <button onClick={() => setDeleteId(o.id)} className="text-xs text-red-500">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? "Modifier l'opportunité" : "Nouvelle opportunité"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              required
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">- Aucun -</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.montant}
                onChange={(e) => setForm({ ...form, montant: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                value={form.statut}
                onChange={(e) => setForm({ ...form, statut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {STATUTS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de clôture</label>
              <input
                type="date"
                value={form.date_cloture}
                onChange={(e) => setForm({ ...form, date_cloture: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50">
              {saving ? "..." : editId ? "Modifier" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer l'opportunité"
        message="Cette action est irréversible."
      />
    </div>
  );
}
