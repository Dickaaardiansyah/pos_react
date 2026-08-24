// src/features/capital/components/EquityStatement.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Laporan Perubahan Modal per periode: Modal Awal, setoran,
// laba/rugi periode, prive/penarikan, sampai Modal Akhir.
// ─────────────────────────────────────────────────────────────────────────────
import { PageLoader, EmptyState } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";

export default function EquityStatement({ c }) {
  const e = c.equityStatement;
  return (
    <div className="card mb-4">
      <div className="chart-card__title">Laporan Perubahan Modal</div>
      <div className="text-sm text-muted mb-3">
        Laporan keuangan ketiga (di samping Laba Rugi &amp; Neraca) — menjelaskan kenapa ekuitas berubah dalam satu
        periode: dari setoran/penarikan pemilik, dan dari laba/rugi yang dihasilkan usaha.
      </div>

      <div className="flex gap-3 mb-4" style={{ flexWrap: "wrap" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Dari Tanggal</label>
          <input type="date" className="form-input" value={c.equityStartDate} onChange={(ev) => c.setEquityStartDate(ev.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Sampai Tanggal</label>
          <input type="date" className="form-input" value={c.equityEndDate} onChange={(ev) => c.setEquityEndDate(ev.target.value)} />
        </div>
      </div>

      {c.equityStatementLoading ? <PageLoader /> : !e ? (
        <EmptyState title="Belum ada data" description="Data laporan perubahan modal tidak tersedia" />
      ) : (
        <div className="table-container">
          <table>
            <tbody>
              <tr>
                <td className="text-sm">Modal Awal <span className="text-muted">({formatDate(e.start_date)})</span></td>
                <td className="font-mono text-right">{formatRupiah(e.modal_awal)}</td>
              </tr>
              <tr>
                <td className="text-sm">(+) Setoran Modal</td>
                <td className="font-mono text-right text-positive">{formatRupiah(e.setoran_periode)}</td>
              </tr>
              <tr>
                <td className="text-sm">{e.laba_rugi_periode >= 0 ? "(+) Laba Bersih Periode" : "(–) Rugi Bersih Periode"}</td>
                <td className={`font-mono text-right ${e.laba_rugi_periode >= 0 ? "text-positive" : "text-negative"}`}>{formatRupiah(e.laba_rugi_periode)}</td>
              </tr>
              <tr>
                <td className="text-sm">(–) Prive / Penarikan Modal</td>
                <td className="font-mono text-right text-negative">-{formatRupiah(e.penarikan_periode)}</td>
              </tr>
              <tr style={{ borderTop: "2px solid var(--border-color, #e5e7eb)" }}>
                <td className="text-sm font-bold">Modal Akhir <span className="text-muted font-normal">({formatDate(e.end_date)})</span></td>
                <td className="font-mono font-bold text-right">{formatRupiah(e.modal_akhir)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-muted mt-3 mb-0">
        Laba/Rugi Bersih di atas adalah sebelum pajak (sistem belum memposting Pajak Penghasilan sebagai jurnal) —
        untuk laba bersih setelah pajak, lihat Laporan Laba Rugi.
      </p>
    </div>
  );
}