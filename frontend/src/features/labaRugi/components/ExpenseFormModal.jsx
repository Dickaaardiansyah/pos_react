// src/features/labaRugi/components/ExpenseFormModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Modal catat/edit biaya operasional.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { RupiahInput } from "../../../components/UI";
import { EMPTY_EXPENSE_FORM } from "../hooks";

export default function ExpenseFormModal({ categories, editExpense, onSubmit, onClose }) {
  const [form, setForm] = useState(editExpense ? { ...editExpense } : EMPTY_EXPENSE_FORM);
  const [submitting, setSubmitting] = useState(false);

  function setField(name, value) { setForm((f) => ({ ...f, [name]: value })); }

  async function submit() {
    setSubmitting(true);
    const ok = await onSubmit(form);
    setSubmitting(false);
    if (ok) onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--small">
        <div className="modal-header"><h2 className="modal-title">{editExpense ? "Edit Biaya" : "Catat Biaya Operasional"}</h2></div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Tanggal</label>
            <input type="date" className="form-input" value={form.expense_date} onChange={(e) => setField("expense_date", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Kategori</label>
            <select className="form-select" value={form.category} onChange={(e) => setField("category", e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Keterangan</label>
            <input className="form-input" value={form.description || ""} onChange={(e) => setField("description", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Jumlah (Rp)</label>
            <RupiahInput value={form.amount} onChange={(v) => setField("amount", v)} />
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