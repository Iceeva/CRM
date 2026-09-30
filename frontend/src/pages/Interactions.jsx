/**
 * pages/Interactions.jsx — Liste de toutes les interactions
 */
import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import Modal from "../components/Modal";
import SearchBar from "../components/SearchBar";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";

const TYPES = ["appel", "email", "reunion", "note"];

const TYPE_ICONS = {
  appel: "📞",
  email: "📧",
  reunion: "🤝",
  note: "📝",
};

const emptyForm = {
  client_id: "",
  prospect_id: "",
  type: "appel",
  sujet: "",
  contenu: "",
  date: new Date().toISOString().split("T")[0],
};

export default function Interactions() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState([]);
  const [prospects, setProspects] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, search };
      if (filterType) params.type = filterType;
      const [iRes, cRes, pRes] = await Promise.all([
        api.get("/interactions", { params }),
        api.get("/clients", { params: { limit: 200 } }),
        api.get("/prospects", { params: { limit: 200 } }),
      ]);
      setItems(iRes.data.data);
      setTotal(iRes.data.total);
      setTotalPages(iRes.data.totalPages);
      setClients(cRes.data.data || []);
      setProspects(pRes.data.data || []);
    } catch {
      toast.error("Erreur chargement");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search, filterType]);

  const openCreate = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().split("T")[0] });
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (i) => {
    setForm({
      client_id: i.client_id || "",
      prospect_id: i.prospect_id || "",
      type: i.type || "appel",
      sujet: i.sujet || "",
      contenu: i.contenu || "",
      date: (i.date || i.created_at || "").split("T")[0],
    });
    setEditId(i.id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.client_id) delete payload.client_id;
      if (!payload.prospect_id) delete payload.prospect_id;

      if (editId) {
        await api.put(`/interactions/${editId}`, payload);
        toast.success("Interaction modifiée");
      } else {
        await api.post("/interactions", payload);
        toast.success("Interaction créée");
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
      await api.delete(`/interactions/${deleteId}`);
      toast.success("Interaction supprimée");
      fetchData();
    } catch {
      toast.error("Erreur suppression");
    }
  };

  const getContactName = (i) => {
    if (i.client_id) {
      const c = clients.find((cl) => cl.id === i.client_id);
      return c ? `👤 ${c.nom}` : "Client inconnu";
    }
    if (i.prospect_id) {
      const p = prospects.find((pr) => pr.id === i.prospect_id);
      return p ? `🎯 ${p.nom}` : "Prospect inconnu";
    }
    return "—";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interactions</h1>
          <p className="text-gray-500 text-sm mt-1">{total} interaction{total > 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-5 py-2.5 rounded-lg transition shadow-sm"
        >
          + Nouvelle interaction
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher..." />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">Tous les types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-gray-500">Aucune interaction trouvée</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((i) => (
              <div key={i.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition">
                <div className="text-2xl pt-1">{TYPE_ICONS[i.type] || "📝"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">{i.sujet}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                      {i.type}
                    </span>
                  </div>
                  {i.contenu && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{i.contenu}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{getContactName(i)}</span>
                    <span>{new Date(i.date || i.created_at).toLocaleString("fr-FR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => openEdit(i)} className="text-xs text-primary-600">✏️</button>
                  <button onClick={() => setDeleteId(i.id)} className="text-xs text-red-500">🗑️</button>
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
        title={editId ? "Modifier l'interaction" : "Nouvelle interaction"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sujet *</label>
            <input
              required
              value={form.sujet}
              onChange={(e) => setForm({ ...form, sujet: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value, prospect_id: "" })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">— Aucun —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prospect</label>
              <select
                value={form.prospect_id}
                onChange={(e) => setForm({ ...form, prospect_id: e.target.value, client_id: "" })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">— Aucun —</option>
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenu</label>
            <textarea
              value={form.contenu}
              onChange={(e) => setForm({ ...form, contenu: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50">
              {saving ? "..." : editId ? "Modifier" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer l'interaction"
        message="Cette action est irréversible."
      />
    </div>
  );
}
