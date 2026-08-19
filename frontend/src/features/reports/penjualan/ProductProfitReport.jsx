// src/features/reports/penjualan/ProductProfitReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Laba per Produk (modul Penjualan).
// ─────────────────────────────────────────────────────────────────────────────
import { TrendingUp, ShoppingBag, Wallet, Percent } from "lucide-react";
import { StatCard } from "../../../components/UI";
import { formatRupiah, formatDate, formatQty } from "../../../utils/format";
import { PROFIT_SORT_OPTIONS } from "../hooks";

export function ProductProfitContent({ r }) {
  const rep = r.profitReport;
  if (!rep) return null;
  const s = rep.summary || {};
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={TrendingUp} tone="blue" label="Total Pendapatan" value={formatRupiah(s.total_revenue || 0)} />
        <StatCard icon={ShoppingBag} tone="orange" label="Total HPP" value={formatRupiah(s.total_cogs || 0)} />
        <StatCard icon={Wallet} tone="green" label="Total Laba" value={formatRupiah(s.total_profit || 0)} />
        <StatCard icon={Percent} tone="purple" label="Margin" value={`${(s.margin_percent || 0).toFixed(1)}%`} />
      </div>
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="chart-card__title" style={{ marginBottom: 0 }}>Laba per Produk</div>
          <select className="form-select" style={{ width: "auto" }} value={r.profitSort} onChange={(e) => r.setProfitSort(e.target.value)}>
            {PROFIT_SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Produk</th><th>Qty</th><th>Pendapatan</th><th>HPP</th><th>Laba</th><th>Margin</th></tr>
            </thead>
            <tbody>
              {r.sortedProfitProducts.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{formatQty(p.total_qty_base)}{p.base_unit ? ` ${p.base_unit}` : ""}</td>
                  <td className="font-mono">{formatRupiah(p.total_revenue)}</td>
                  <td className="font-mono text-muted">{formatRupiah(p.total_cogs)}</td>
                  <td className="font-mono text-success">{formatRupiah(p.total_profit)}</td>
                  <td>{(p.margin_percent || 0).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Payload cetak / ekspor Excel — dipakai dari ReportsPage.jsx ────────────
export function buildProductProfitExportPayload(r) {
  if (!r.profitReport) return null;
  const s = r.profitReport.summary || {};
  return {
    title: "Laporan Laba per Produk",
    periodLabel: `${formatDate(r.profitStartDate)} – ${formatDate(r.profitEndDate)}`,
    columns: [
      { key: "name", label: "Produk" }, { key: "total_revenue", label: "Pendapatan" },
      { key: "total_cogs", label: "HPP" }, { key: "total_profit", label: "Laba" },
    ],
    rows: (r.sortedProfitProducts || []).map((p) => ({
      name: p.name,
      total_revenue: formatRupiah(p.total_revenue),
      total_cogs: formatRupiah(p.total_cogs),
      total_profit: formatRupiah(p.total_profit),
    })),
    summary: [
      { label: "Total Laba", value: formatRupiah(s.total_profit || 0) },
    ],
  };
}
