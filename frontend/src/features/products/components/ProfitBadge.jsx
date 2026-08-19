// src/features/products/components/ProfitBadge.jsx
import { formatRupiah } from "../../../utils/format";

// Selisih Harga Eceran - Harga Modal, dihitung ulang tiap kali salah satu
// berubah (baik cost_price manual maupun otomatis dari Harga Beli ÷ Isi).
// Ditampilkan hijau kalau untung, merah kalau rugi (harga jual < modal).
export default function ProfitBadge({ price, costPrice, unitName }) {
  const profit = price - costPrice;
  const markup = costPrice > 0 ? (profit / costPrice) * 100 : 0;
  const tone = profit >= 0 ? "success" : "error";
  const dot = profit >= 0 ? "🟢" : "🔴";
  return (
    <div className={`form-hint form-hint--${tone}`} style={{ marginTop: 6 }}>
      <div>{dot} Untung {formatRupiah(Math.abs(profit))} / {unitName || "satuan dasar"}{profit < 0 ? " (rugi)" : ""}</div>
      <div>{dot} Markup {markup.toFixed(1).replace(/\.0$/, "")}%</div>
    </div>
  );
}
