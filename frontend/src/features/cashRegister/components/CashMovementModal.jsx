// src/features/cashRegister/components/CashMovementModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Form modal untuk mencatat kas masuk (in) atau kas keluar (out)
// pada sesi kas yang sedang berjalan. State form murni lokal ke input; hasilnya
// diserahkan ke pemanggil lewat onSubmit.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { X } from "lucide-react";
import { RupiahInput } from "../../../components/UI";

export default function CashMovementModal({ title, type, categories, submitting, onSubmit, onClose }) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Kategori</label>
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Pilih kategori...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Jumlah (Rp)</label>
            <RupiahInput placeholder="Contoh: 10.000" value={amount} onChange={(v) => setAmount(v)} />
          </div>
          <div className="form-group">
            <label className="form-label">Keterangan (opsional)</label>
            <input className="form-input" placeholder="Mis. Sedekah ke masjid" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Batal</button>
          <button
            className={`btn ${type === "in" ? "btn-success" : "btn-danger"}`}
            onClick={() => onSubmit({ category, amount, description })}
            disabled={submitting}
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}