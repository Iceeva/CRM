/**
 * pages/Clients.jsx - Liste des clients avec CRUD
 */
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import Modal from "../components/Modal";
import SearchBar from "../components/SearchBar";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import Icon, { InteractionIcon } from "../components/Icon";

const STATUTS = ["actif", "inactif", "vip"];

const emptyForm = {
  nom: "",
  email: "",
  telephone: "",
  entreprise: "",
  statut: "actif",
  notes: "",
};

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15, search };
      if (filterStatut) params.statut = filterStatut;
      const res = await api.get("/clients", { params });
      setClients(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error("Erreur chargement clients");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatut]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Reset page on search/filter change
  useEffect(() => {
    setPage(1);
  }, [search, filterStatut]);

  const openCreate = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (client) => {
    setForm({
      nom: client.nom || "",
      email: client.email || "",
      telephone: client.telephone || "",
      entreprise: client.entreprise || "",
      statut: client.statut || "actif",
      notes: client.notes || "",
    });
    setEditId(client.id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/clients/${editId}`, form);
        toast.success("Client modifié");
      } else {
        await api.post("/clients", form);
        toast.success("Client créé");
      }
      setModalOpen(false);
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/clients/${deleteId}`);
      toast.success("Client supprimé");
      fetchClients();
    } catch {
      toast.error("Erreur suppression");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">{total} client{total > 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-5 py-2.5 rounded-lg transition shadow-sm"
        >
          + Nouveau client
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un client..." />
        </div>
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3"><Icon name="people" /></p>
            <p className="text-gray-500">Aucun client trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Nom</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Entreprise</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">Téléphone</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <Link
                        to={`/clients/${c.id}`}
                        className="font-medium text-gray-800 hover:text-primary-600"
                      >
                        {c.nom}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{c.email}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{c.entreprise || "-"}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{c.telephone || "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.statut === "actif"
                            ? "bg-green-100 text-green-700"
                            : c.statut === "vip"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(c)}
                          className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                        >
                          <Icon name="pencil-square" title="Modifier" />
                        </button>
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          <Icon name="trash" title="Supprimer" />
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
        title={editId ? "Modifier le client" : "Nouveau client"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                required
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise</label>
              <input
                value={form.entreprise}
                onChange={(e) => setForm({ ...form, entreprise: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={form.statut}
              onChange={(e) => setForm({ ...form, statut: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              {STATUTS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition disabled:opacity-50"
            >
              {saving ? "..." : editId ? "Modifier" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer le client"
        message="Cette action est irréversible. Le client sera définitivement supprimé."
      />
    </div>
  );
}
