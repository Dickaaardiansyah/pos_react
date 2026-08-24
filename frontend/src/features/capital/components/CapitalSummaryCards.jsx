// src/features/capital/components/CapitalSummaryCards.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Kartu ringkasan Modal Awal, Ekuitas Saat Ini, perubahan dari
// Modal Awal, laba/rugi kumulatif, dan total setoran/penarikan tambahan.
// ─────────────────────────────────────────────────────────────────────────────
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatRupiah, formatDate } from "../../../utils/format";

export default function CapitalSummaryCards({ summary: s }) {
  return (
    <div className="mutation-summary mb-4">
      <div className="mutation-summary__card">
        <div className="mutation-summary__label">Modal Awal</div>
        <div className="mutation-summary__value">{s.has_modal_awal ? formatRupiah(s.modal_awal) : "Belum diinput"}</div>
        {s.tanggal_modal_awal && <div className="mutation-summary__sub">{formatDate(s.tanggal_modal_awal)}</div>}
      </div>
      <div className="mutation-summary__card">
        <div className="mutation-summary__label">Ekuitas Saat Ini</div>
        <div className="mutation-summary__value">{formatRupiah(s.ekuitas_saat_ini)}</div>
        <div className="mutation-summary__sub">Modal + Laba/Rugi kumulatif, per {formatDate(s.as_of_date)}</div>
      </div>
      <div className="mutation-summary__card">
        <div className="mutation-summary__label">Perubahan dari Modal Awal</div>
        <div className={`mutation-summary__value flex items-center gap-2 ${s.status === "naik" ? "text-positive" : s.status === "turun" ? "text-negative" : ""}`}>
          {s.status === "naik" && <TrendingUp size={16} />}
          {s.status === "turun" && <TrendingDown size={16} />}
          {formatRupiah(s.selisih_dari_modal_awal)}
        </div>
        <div className="mutation-summary__sub">
          {s.persentase_perubahan === null ? "Input Modal Awal untuk melihat persentase" : `${s.persentase_perubahan > 0 ? "+" : ""}${s.persentase_perubahan}% — ${s.status === "naik" ? "Naik" : s.status === "turun" ? "Turun" : "Tetap"}`}
        </div>
      </div>
      <div className="mutation-summary__card">
        <div className="mutation-summary__label">Laba/Rugi Kumulatif</div>
        <div className={`mutation-summary__value ${s.laba_rugi_kumulatif >= 0 ? "text-positive" : "text-negative"}`}>{formatRupiah(s.laba_rugi_kumulatif)}</div>
        <div className="mutation-summary__sub">Dari seluruh penjualan &amp; biaya sejak awal</div>
      </div>
      <div className="mutation-summary__card">
        <div className="mutation-summary__label">Setoran Tambahan / Penarikan</div>
        <div className="mutation-summary__value text-sm">
          <div>+ {formatRupiah(s.total_setoran_tambahan)}</div>
          <div>- {formatRupiah(s.total_penarikan)}</div>
        </div>
      </div>
    </div>
  );
}