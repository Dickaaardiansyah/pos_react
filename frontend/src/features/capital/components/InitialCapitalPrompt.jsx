// src/features/capital/components/InitialCapitalPrompt.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Kartu peringatan yang tampil selama Modal Awal belum diinput,
// berisi penjelasan singkat dan form untuk mengisinya.
// ─────────────────────────────────────────────────────────────────────────────
import CapitalForm from "./CapitalForm";

export default function InitialCapitalPrompt({ c }) {
  return (
    <div className="card mb-4" style={{ borderLeft: "3px solid var(--color-warning, #f59e0b)" }}>
      <div className="chart-card__title">Modal Awal belum diinput</div>
      <div className="text-sm text-muted mb-3">
        Modal Awal adalah setoran modal pertama saat usaha ini mulai dijalankan. Setelah diinput, sistem akan
        memakainya sebagai patokan untuk menghitung apakah ekuitas usaha naik atau turun dari waktu ke waktu,
        terhubung otomatis dengan seluruh pembelian, penjualan, biaya, dan kas kecil.
      </div>
      <CapitalForm c={c} isInitial />
    </div>
  );
}