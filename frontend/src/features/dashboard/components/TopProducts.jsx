// src/features/dashboard/components/TopProducts.jsx
import { Award } from "lucide-react";
import { formatRupiah, formatQty } from "../../../utils/format";
import RankBar from "./RankBar";

export default function TopProducts({ products, periodLabel }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <div className="dashboard-section-icon dashboard-section-icon--blue"><Award size={16} /></div>
        <div>
          <div className="ui-section-header__title">Penjualan Terlaris</div>
          <div className="ui-section-header__subtitle">5 produk dengan omzet tertinggi — {periodLabel}</div>
        </div>
      </div>
      {products.length === 0 ? (
        <div className="text-sm text-muted">Belum ada penjualan tercatat pada periode ini.</div>
      ) : (
        <TopProductsList products={products} />
      )}
    </div>
  );
}

function TopProductsList({ products }) {
  const maxRevenue = Math.max(...products.map((p) => p.revenue), 1);
  return (
    <div className="dashboard-rank-list">
      {products.map((p, idx) => (
        <div className="dashboard-rank-item" key={`${p.name}-${idx}`}>
          <div className={`dashboard-rank-item__badge dashboard-rank-item__badge--${idx + 1}`}>{idx + 1}</div>
          <div className="dashboard-rank-item__body">
            <div className="dashboard-rank-item__row">
              <div className="dashboard-rank-item__title">{p.name}</div>
              <div className="dashboard-rank-item__value">{formatRupiah(p.revenue)}</div>
            </div>
            <div className="dashboard-rank-item__subtitle">{p.category} · {formatQty(p.qty)} {p.base_unit || "unit"} terjual</div>
            <RankBar value={p.revenue} max={maxRevenue} />
          </div>
        </div>
      ))}
    </div>
  );
}
