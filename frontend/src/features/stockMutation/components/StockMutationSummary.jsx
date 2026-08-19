// src/features/stockMutation/components/StockMutationSummary.jsx
import { formatNumber } from "../../../utils/format";

export default function StockMutationSummary({ summary }) {
  if (summary.length === 0) return null;

  return (
    <div className="mutation-summary">
      {summary.map((s) => (
        <div key={s.jenis_mutasi} className="mutation-summary__card">
          <div className="mutation-summary__label">{s.jenis_mutasi_label}</div>
          <div className="mutation-summary__value">{s.total_mutasi} mutasi</div>
          <div className="mutation-summary__sub">Masuk +{formatNumber(s.total_qty_masuk)} • Keluar -{formatNumber(s.total_qty_keluar)}</div>
        </div>
      ))}
    </div>
  );
}
