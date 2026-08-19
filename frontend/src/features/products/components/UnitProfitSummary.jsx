// src/features/products/components/UnitProfitSummary.jsx
import { formatRupiah, formatQty } from "../../../utils/format";
import { buildUnitProfitSummary } from "../utils/productFormHelper";

export default function UnitProfitSummary({ form }) {
  const summary = buildUnitProfitSummary(form);
  if (!summary) return null;

  return (
    <div className="unit-profit-summary">
      <div className="unit-profit-summary__title">
        Kesimpulan setara 1 {summary.referenceUnitName} ({formatQty(summary.totalQty)} {summary.baseUnitName})
      </div>
      <div className="unit-profit-summary__modal">Modal: {formatRupiah(summary.totalModal)}</div>
      {summary.lines.map((line) => {
        const tone = line.profit >= 0 ? "success" : "error";
        const dot = line.profit >= 0 ? "🟢" : "🔴";
        const desc = line.isWholeBatchUnit
          ? `Jika terjual sebagai ${line.name}`
          : `Jika seluruhnya dijual eceran @ ${formatRupiah(line.price)}/${line.name}`;
        return (
          <div key={line.name} className={`unit-profit-summary__line form-hint--${tone}`}>
            {dot} {desc}: {formatRupiah(line.revenue)} → {line.profit >= 0 ? "Untung" : "Rugi"}{" "}
            {formatRupiah(Math.abs(line.profit))} (Markup {line.markup.toFixed(1).replace(/\.0$/, "")}%)
          </div>
        );
      })}
    </div>
  );
}
