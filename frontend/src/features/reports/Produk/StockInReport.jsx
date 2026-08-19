// src/features/reports/produk/StockInReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Barang Masuk (modul Produk & Stok). Menampilkan produk
// yang paling banyak dibeli/masuk berdasarkan data pembelian pada periode ini.
// ─────────────────────────────────────────────────────────────────────────────
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Truck, PackageX, ShoppingBag } from "lucide-react";
import { StatCard } from "../../../components/UI";
import { formatRupiah, formatDate, formatChartPeriod, formatQty } from "../../../utils/format";
import { PURCHASE_SORT_OPTIONS } from "../hooks";

export function StockInContent({ r }) {
  const rep = r.purchaseReport;
  if (!rep) return null;
  const s = rep.summary || {};
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Truck} tone="blue" label="Total Biaya" value={formatRupiah(s.total_cost || 0)} />
        <StatCard icon={PackageX} tone="cyan" label="Total Qty" value={formatQty(s.total_qty || 0)} />
        <StatCard icon={ShoppingBag} tone="green" label="Transaksi" value={s.total_transactions || s.transaction_count || 0} />
      </div>
      {r.purchaseChartData?.length > 0 && (
        <div className="card chart-card mb-4">
          <div className="chart-card__title">Pembelian per Periode</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={r.purchaseChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => formatChartPeriod(v, r.period)} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 12 }} labelFormatter={(v) => formatChartPeriod(v, r.period)} formatter={(v) => formatRupiah(v)} />
              <Bar dataKey="cost" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="chart-card__title" style={{ marginBottom: 0 }}>Produk Terbanyak Dibeli</div>
          <select className="form-select" style={{ width: "auto" }} value={r.purchaseSort} onChange={(e) => r.setPurchaseSort(e.target.value)}>
            {PURCHASE_SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Produk</th><th>Qty</th><th>Biaya</th></tr></thead>
            <tbody>
              {r.sortedPurchaseTopProducts.map((p, i) => (
                <tr key={i}>
                  <td>{p.product_name}</td>
                  <td>{formatQty(p.total_qty)}</td>
                  <td className="font-mono">{formatRupiah(p.total_cost)}</td>
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
export function buildStockInExportPayload(r) {
  if (!r.purchaseReport) return null;
  const s = r.purchaseReport.summary || {};
  return {
    title: "Laporan Barang Masuk",
    periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
    columns: [
      { key: "product_name", label: "Produk" }, { key: "total_qty", label: "Qty" }, { key: "total_cost", label: "Biaya" },
    ],
    rows: (r.sortedPurchaseTopProducts || []).map((p) => ({
      product_name: p.product_name,
      total_qty: formatQty(p.total_qty),
      total_cost: formatRupiah(p.total_cost),
    })),
    summary: [{ label: "Total Biaya", value: formatRupiah(s.total_cost || 0) }],
  };
}
