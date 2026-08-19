// src/features/reports/penjualan/SalesByCustomerReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Penjualan per Pelanggan (modul Penjualan).
// ─────────────────────────────────────────────────────────────────────────────
import { Users, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { StatCard } from "../../../components/UI";
import { formatRupiah, formatDate, formatQty } from "../../../utils/format";
import { CUSTOMER_SORT_OPTIONS } from "../hooks";

export function SalesByCustomerContent({ r }) {
  const rep = r.customerReport;
  if (!rep) return null;
  const s = rep.summary || {};
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Users} tone="blue" label="Jumlah Pelanggan" value={s.total_customers || 0} />
        <StatCard icon={ShoppingCart} tone="green" label="Total Transaksi" value={s.total_transactions || 0} />
        <StatCard icon={TrendingUp} tone="purple" label="Total Pendapatan" value={formatRupiah(s.total_revenue || 0)} />
        <StatCard icon={Wallet} tone="cyan" label="Total Laba" value={formatRupiah(s.total_profit || 0)} />
      </div>
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="chart-card__title" style={{ marginBottom: 0 }}>Per Pelanggan</div>
          <select className="form-select" style={{ width: "auto" }} value={r.customerSort} onChange={(e) => r.setCustomerSort(e.target.value)}>
            {CUSTOMER_SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Pelanggan</th><th>Transaksi</th><th>Qty</th><th>Pendapatan</th><th>HPP</th><th>Laba</th></tr>
            </thead>
            <tbody>
              {r.sortedCustomers.map((c, i) => (
                <tr key={i}>
                  <td>{c.customer_name}</td>
                  <td>{c.transaction_count}</td>
                  <td>{formatQty(c.total_qty)}</td>
                  <td className="font-mono">{formatRupiah(c.total_revenue)}</td>
                  <td className="font-mono text-muted">{formatRupiah(c.total_cogs)}</td>
                  <td className="font-mono text-success">{formatRupiah(c.total_profit)}</td>
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
export function buildSalesByCustomerExportPayload(r) {
  if (!r.customerReport) return null;
  const s = r.customerReport.summary || {};
  return {
    title: "Laporan Penjualan per Pelanggan",
    periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
    columns: [
      { key: "customer_name", label: "Pelanggan" }, { key: "transaction_count", label: "Transaksi" },
      { key: "total_revenue", label: "Pendapatan" }, { key: "total_profit", label: "Laba" },
    ],
    rows: (r.sortedCustomers || []).map((c) => ({
      customer_name: c.customer_name, transaction_count: c.transaction_count,
      total_revenue: formatRupiah(c.total_revenue), total_profit: formatRupiah(c.total_profit),
    })),
    summary: [
      { label: "Jumlah Pelanggan", value: s.total_customers || 0 },
      { label: "Total Pendapatan", value: formatRupiah(s.total_revenue || 0) },
    ],
  };
}
