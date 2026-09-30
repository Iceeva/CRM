/**
 * pages/Prospects.jsx — Liste des prospects avec CRUD + conversion
 */
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import Modal from "../components/Modal";
import SearchBar from "../components/SearchBar";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";

const STATUTS = ["nouveau", "contacte", "qualifie", "converti"];
const SOURCES = ["site_web", "linkedin", "salon", "recommandation", "publicite", "autre"];

const emptyForm = {
  nom: "",
  email: "",
  telephone: "",
  entreprise: "",
  source: "site_web",
  notes: "",
};

export default function Prospects() {
  const [prospects, setProspects] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState(null);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15, search };
      if (filterStatut) params.statut = filterStatut;
      const res = await api.get("/prospects", { params });
      setProspects(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error("Erreur chargement prospects");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatut]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatut]);

  const openCreate = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setForm({
      nom: p.nom || "",
      email: p.email || "",
      telephone: p.telephone || "",
      entreprise: p.entreprise || "",
      source: p.source || "site_web",
      notes: p.notes || "",
    });
    setEditId(p.id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/prospects/${editId}`, form);
        toast.success("Prospect modifié");
      } else {
        await api.post("/prospects", form);
        toast.success("Prospect créé");
      }
      setModalOpen(false);
      fetchProspects();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/prospects/${deleteId}`);
      toast.success("Prospect supprimé");
      fetchProspects();
    } catch {
      toast.error("Erreur suppression");
    }
  };

  const handleConvert = async (id) => {
    try {
      await api.post(`/prospects/${id}/convert`);
      toast.success("Prospect converti en client ! 🎉");
      fetchProspects();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erreur conversion");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500 text-sm mt-1">{total} prospect{total > 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2.5 rounded-lg transition shadow-sm"
        >
          + Nouveau prospect
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un prospect..." />
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : prospects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-gray-500">Aucun prospect trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Nom</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Entreprise</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">Source</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prospects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <Link
                        to={`/prospects/${p.id}`}
                        className="font-medium text-gray-800 hover:text-green-600"
                      >
                        {p.nom}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.email}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{p.entreprise || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell capitalize">{p.source || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.statut === "nouveau"
                            ? "bg-blue-100 text-blue-700"
                            : p.statut === "contacte"
                            ? "bg-amber-100 text-amber-700"
                            : p.statut === "qualifie"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {p.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.statut !== "converti" && (
                          <button
                            onClick={() => handleConvert(p.id)}
                            className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded font-medium transition"
                            title="Convertir en client"
                          >
                            → Client
                          </button>
                        )}
                        <button onClick={() => openEdit(p)} className="text-xs text-primary-600">
                          ✏️
                        </button>
                        <button onClick={() => setDeleteId(p.id)} className="text-xs text-red-500">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Modal create/edit */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? "Modifier le prospect" : "Nouveau prospect"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                required
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise</label>
              <input
                value={form.entreprise}
                onChange={(e) => setForm({ ...form, entreprise: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ").charAt(0).toUpperCase() + s.replace("_", " ").slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
            >
              {saving ? "..." : editId ? "Modifier" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer le prospect"
        message="Cette action est irréversible."
      />
    </div>
  );
}
