// src/features/capital/components/CapitalForm.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Form input Modal Awal (isInitial) atau setoran/penarikan
// modal tambahan. Field state ada di hook (c.form/c.updateForm) supaya nilainya
// bisa direset otomatis setelah submit sukses.
// ─────────────────────────────────────────────────────────────────────────────
import { RupiahInput } from "../../../components/UI";

function formatRupiah(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

export default function CapitalForm({ c, isInitial }) {
  const f = c.form;
  const insufficientBalance =
    f.target_account === "kas" &&
    c.availableBalance !== null &&
    c.availableBalance < Number(f.amount || 0);

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

      {f.target_account === "kas" && (
        <div className="form-group">
          <label className="form-label">Sumber Dana</label>
          <select className="form-select" value={f.payment_source} onChange={(e) => c.updateForm("payment_source", e.target.value)}>
            <option value="laci">Kas Laci (laci kasir yang sedang terbuka)</option>
            <option value="kantor">Kas Kantor</option>
          </select>

          {f.payment_source === "laci" ? (
            <>
              <div className="text-xs text-muted mt-1 mb-2">
                Diambil dari sesi kas kasir yang sedang terbuka. Ditolak kalau tidak ada sesi kas aktif atau saldo laci tidak cukup.
              </div>
              {c.openShifts.length > 1 && (
                <select
                  className="form-select mb-2"
                  value={f.shift_id}
                  onChange={(e) => c.updateForm("shift_id", e.target.value)}
                >
                  <option value="">Pilih laci...</option>
                  {c.openShifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.cashier_name || sh.opened_by} — {formatRupiah(sh.expected_balance)}
                    </option>
                  ))}
                </select>
              )}
              {c.balanceLoading ? (
                <div className="text-xs text-muted mb-2">Memuat saldo laci...</div>
              ) : c.openShifts.length === 0 ? (
                <div className="text-xs text-danger mb-2">Tidak ada sesi kas (laci) yang sedang terbuka.</div>
              ) : c.selectedShift ? (
                <div className={`statement-row mb-2 ${insufficientBalance ? "text-danger" : ""}`}>
                  <span>Saldo Laci ({c.selectedShift.cashier_name || c.selectedShift.opened_by})</span>
                  <span className="statement-value">{formatRupiah(c.availableBalance)}</span>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="text-xs text-muted mt-1 mb-2">
                Tidak tertaut ke laci kasir manapun. Ditolak kalau saldo Kas Kantor tidak cukup.
              </div>
              {c.balanceLoading ? (
                <div className="text-xs text-muted mb-2">Memuat saldo...</div>
              ) : c.cashBalances ? (
                <div className={`statement-row mb-2 ${insufficientBalance ? "text-danger" : ""}`}>
                  <span>Saldo Kas Kantor</span>
                  <span className="statement-value">{formatRupiah(c.availableBalance)}</span>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Jumlah (Rp)</label>
        <RupiahInput placeholder="Mis. 10.000.000" value={f.amount} onChange={(v) => c.updateForm("amount", v)} />
      </div>

      <div className="form-group">
        <label className="form-label">Keterangan (opsional)</label>
        <input className="form-input" placeholder={isInitial ? "Mis. Modal awal pendirian usaha" : "Mis. Tambahan modal dari pemilik"} value={f.description} onChange={(e) => c.updateForm("description", e.target.value)} />
      </div>

      <button
        className="btn btn-primary w-full mt-2"
        onClick={handleSubmit}
        disabled={
          c.submitting ||
          (f.target_account === "kas" && f.payment_source === "laci" && !f.shift_id)
        }
      >
        {c.submitting ? "Menyimpan..." : isInitial ? "Simpan sebagai Modal Awal" : "Simpan Transaksi Modal"}
      </button>
    </div>
  );
}