// src/features/capital/components/CapitalForm.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Form input Modal Awal (isInitial) atau setoran/penarikan
// modal tambahan. Field state ada di hook (c.form/c.updateForm) supaya nilainya
// bisa direset otomatis setelah submit sukses.
// ─────────────────────────────────────────────────────────────────────────────
import { RupiahInput } from "../../../components/UI";

export default function CapitalForm({ c, isInitial }) {
  const f = c.form;

  async function handleSubmit() {
    await c.submit(isInitial);
  }

  return (
    <div className="card">
      <div className="chart-card__title">{isInitial ? "Input Modal Awal" : "Setoran / Penarikan Modal"}</div>

      {!isInitial && (
        <div className="form-group">
          <label className="form-label">Jenis</label>
          <select className="form-select" value={f.type} onChange={(e) => c.updateForm("type", e.target.value)}>
            <option value="setoran">Setoran Modal Tambahan</option>
            <option value="penarikan">Penarikan Modal (Prive)</option>
          </select>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Tanggal</label>
        <input type="date" className="form-input" value={f.transaction_date} onChange={(e) => c.updateForm("transaction_date", e.target.value)} />
      </div>

      <div className="form-group">
        <label className="form-label">Akun {f.type === "penarikan" && !isInitial ? "Sumber" : "Tujuan"}</label>
        <select className="form-select" value={f.target_account} onChange={(e) => c.updateForm("target_account", e.target.value)}>
          <option value="kas">Kas</option>
          <option value="bank">Bank / Non-Tunai</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Jumlah (Rp)</label>
        <RupiahInput placeholder="Mis. 10.000.000" value={f.amount} onChange={(v) => c.updateForm("amount", v)} />
      </div>

      <div className="form-group">
        <label className="form-label">Keterangan (opsional)</label>
        <input className="form-input" placeholder={isInitial ? "Mis. Modal awal pendirian usaha" : "Mis. Tambahan modal dari pemilik"} value={f.description} onChange={(e) => c.updateForm("description", e.target.value)} />
      </div>

      <button className="btn btn-primary w-full mt-2" onClick={handleSubmit} disabled={c.submitting}>
        {c.submitting ? "Menyimpan..." : isInitial ? "Simpan sebagai Modal Awal" : "Simpan Transaksi Modal"}
      </button>
    </div>
  );
}