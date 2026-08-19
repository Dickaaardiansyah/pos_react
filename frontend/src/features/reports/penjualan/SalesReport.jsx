// src/features/reports/penjualan/SalesReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Penjualan (modul Penjualan). Ringkasan penjualan per
// periode: grafik pendapatan, produk terlaris, dan pendapatan per kategori.
// ─────────────────────────────────────────────────────────────────────────────
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, ShoppingCart, Percent } from "lucide-react";
import { StatCard } from "../../../components/UI";
import { formatRupiah, formatDate, formatChartPeriod, formatNumber, formatQty } from "../../../utils/format";
import { SALES_SORT_OPTIONS } from "../hooks";

export function SalesContent({ r }) {
  const rep = r.salesReport;
  if (!rep) return null;
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={TrendingUp} tone="blue" label="Total Pendapatan" value={formatRupiah(rep.summary.total_revenue || 0)} />
        <StatCard icon={ShoppingCart} tone="green" label="Total Transaksi" value={rep.summary.total_transactions || 0} />
        <StatCard icon={TrendingUp} tone="purple" label="Rata-rata / Transaksi" value={formatRupiah(rep.summary.avg_transaction || 0)} />
        <StatCard icon={ShoppingCart} tone="cyan" label="Rata-rata Item / Transaksi" value={formatNumber(Number(rep.summary.avg_items_per_transaction || 0).toFixed(1))} />
        <StatCard icon={Percent} tone="orange" label="Total Diskon" value={formatRupiah(rep.summary.total_discount || 0)} />
      </div>
      <div className="card chart-card mb-4">
        <div className="chart-card__title">Pendapatan per Periode</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={r.salesChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => formatChartPeriod(v, r.period)} />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} />
            <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 12 }} labelFormatter={(v) => formatChartPeriod(v, r.period)} formatter={(v) => formatRupiah(v)} />
            <Bar dataKey="revenue" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="chart-card__title" style={{ marginBottom: 0 }}>Produk Terlaris</div>
            <select className="form-select" style={{ width: "auto" }} value={r.salesSort} onChange={(e) => r.setSalesSort(e.target.value)}>
              {SALES_SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Produk</th><th>Qty Jual</th><th>Qty Dasar</th><th>Pendapatan</th></tr></thead>
              <tbody>
                {r.sortedSalesTopProducts.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td className="text-muted">{formatQty(p.total_qty_sold)}×</td>
                    <td>{formatQty(p.total_qty_base)}{p.base_unit ? ` ${p.base_unit}` : ""}</td>
                    <td className="font-mono">{formatRupiah(p.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="chart-card__title">Pendapatan per Kategori</div>
          <div className="table-container">
            <table>
              <thead><tr><th>Kategori</th><th>Qty Jual</th><th>Pendapatan</th></tr></thead>
              <tbody>
                {(rep.categoryRevenue || []).map((c, i) => (
                  <tr key={i}><td>{c.category}</td><td>{formatQty(c.qty_sold)}×</td><td className="font-mono">{formatRupiah(c.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Payload cetak / ekspor Excel — dipakai dari ReportsPage.jsx ────────────
export function buildSalesExportPayload(r) {
  if (!r.salesReport) return null;
  const s = r.salesReport.summary || {};
  return {
    title: "Laporan Penjualan",
    periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
    columns: [
      { key: "name", label: "Produk" }, { key: "total_qty_sold", label: "Qty Jual" },
      { key: "total_qty_base", label: "Qty Dasar" }, { key: "total_revenue", label: "Pendapatan" },
    ],
    rows: (r.sortedSalesTopProducts || []).map((p) => ({
      name: p.name,
      total_qty_sold: `${formatQty(p.total_qty_sold)}×`,
      total_qty_base: `${formatQty(p.total_qty_base)}${p.base_unit ? ` ${p.base_unit}` : ""}`,
      total_revenue: formatRupiah(p.total_revenue),
    })),
    summary: [
      { label: "Total Pendapatan", value: formatRupiah(s.total_revenue || 0) },
      { label: "Total Transaksi", value: s.total_transactions || 0 },
    ],
  };
}
