// src/features/products/components/StockAdjustModal.jsx
import { useState } from "react";
import { formatQty } from "../../../utils/format";

export default function StockAdjustModal({ product, onUpdate, onClose }) {
  const [type, setType] = useState("in");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const ok = await onUpdate(product, { quantity: parseInt(quantity), type, notes });
    setSubmitting(false);
    if (ok) onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header"><h2 className="modal-title">Sesuaikan Stok — {product.name}</h2></div>
        <div className="modal-body">
          <div className="text-sm text-muted mb-3">Stok saat ini: <b>{formatQty(product.stock)} {product.unit}</b></div>
          <div className="form-group">
            <label className="form-label">Jenis Perubahan</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="in">Tambah Stok (masuk)</option>
              <option value="out">Kurangi Stok (keluar/rusak)</option>
              <option value="adjustment">Set Ulang ke Jumlah Tertentu</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{type === "adjustment" ? "Jumlah Baru" : "Jumlah"}</label>
            <input type="number" className="form-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Catatan (opsional)</label>
            <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}
