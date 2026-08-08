// src/features/customers/CustomersPage.jsx
import { useState } from "react";
import { Plus, Pencil, Trash2, Users, Phone, Mail } from "lucide-react";
import { useCustomers, useCustomerForm } from "./hooks";
import { PageLoader, EmptyState, SearchInput } from "../../components/UI";

export default function Customers() {
  const cp = useCustomers();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(customer) { setEditing(customer); setShowForm(true); }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Pelanggan</div>
          <div className="page-subtitle">{cp.customers.length} pelanggan terdaftar</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Tambah Pelanggan</button>
      </div>

      <div className="page-body">
        <div className="filter-bar">
          <SearchInput value={cp.search} onChange={cp.setSearch} placeholder="Cari nama, telepon, atau email..." className="w-full" />
        </div>

        {cp.loading ? (
          <PageLoader text="Memuat pelanggan..." />
        ) : cp.customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada pelanggan"
            description="Tambahkan data pelanggan pertama Anda"
            action={<button className="btn btn-primary" onClick={openCreate}>Tambah Pelanggan</button>}
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nama</th><th>Telepon</th><th>Email</th><th>Alamat</th><th></th>
                </tr>
              </thead>
              <tbody>
                {cp.customers.map((c) => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.name}</td>
                    <td>{c.phone ? <span className="flex items-center gap-1"><Phone size={12} />{c.phone}</span> : "-"}</td>
                    <td>{c.email ? <span className="flex items-center gap-1"><Mail size={12} />{c.email}</span> : "-"}</td>
                    <td className="text-sm text-muted">{c.address || "-"}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)}><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => cp.removeCustomer(c)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <CustomerFormModal
          editCustomer={editing}
          onSuccess={cp.reload}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function CustomerFormModal({ editCustomer, onSuccess, onClose }) {
  const f = useCustomerForm({ editCustomer, onSuccess, onClose });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{editCustomer ? "Edit Pelanggan" : "Tambah Pelanggan"}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={f.submit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Nama *</label>
              <input className="form-input" value={f.form.name} onChange={(e) => f.setField("name", e.target.value)} placeholder="Nama pelanggan" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Telepon</label>
              <input className="form-input" value={f.form.phone} onChange={(e) => f.setField("phone", e.target.value)} placeholder="08xxxxxxxxxx" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={f.form.email} onChange={(e) => f.setField("email", e.target.value)} placeholder="nama@email.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Alamat</label>
              <textarea className="form-input" rows={2} value={f.form.address} onChange={(e) => f.setField("address", e.target.value)} placeholder="Alamat pelanggan" />
            </div>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-input" rows={2} value={f.form.notes} onChange={(e) => f.setField("notes", e.target.value)} placeholder="Catatan tambahan (opsional)" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={f.saving}>{f.saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}