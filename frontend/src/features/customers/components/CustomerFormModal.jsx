// src/features/customers/components/CustomerFormModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Modal tambah/edit pelanggan. Form state & submit logic ada
// di useCustomerForm (hooks.js); komponen ini murni menampilkannya.
// ─────────────────────────────────────────────────────────────────────────────
import { X } from "lucide-react";
import { useCustomerForm } from "../hooks";

export default function CustomerFormModal({ editCustomer, onSuccess, onClose }) {
  const f = useCustomerForm({ editCustomer, onSuccess, onClose });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{editCustomer ? "Edit Pelanggan" : "Tambah Pelanggan"}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
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