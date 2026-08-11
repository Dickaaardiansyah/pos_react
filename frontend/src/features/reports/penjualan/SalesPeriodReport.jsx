// src/features/reports/penjualan/SalesPeriodReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Penjualan Periode (modul Penjualan).
// Tabel ringkas per hari/minggu/bulan + grafik penjualan.
// Dipisah agar konsisten dengan SalesDailyReport (satu file per jenis laporan).
// ─────────────────────────────────────────────────────────────────────────────
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, ShoppingCart, Percent, Wallet, Receipt } from "lucide-react";
import { StatCard, EmptyState } from "../../../components/UI";
import { formatRupiah, formatDate, formatChartPeriod, formatNumber, formatQty } from "../../../utils/format";

export function SalesPeriodContent({ r }) {
  const rep = r.salesReport;
  if (!rep) return null;
  const s = rep.summary || {};
  const rows = rep.salesData || [];

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={ShoppingCart} tone="blue" label="Total Transaksi" value={s.total_transactions || 0} />
        <StatCard icon={Receipt} tone="cyan" label="Total Item Terjual" value={formatQty(s.total_items_qty || 0)} />
        <StatCard icon={TrendingUp} tone="green" label="Penjualan Kotor / Pendapatan" value={formatRupiah(s.total_revenue || 0)} />
        <StatCard icon={Percent} tone="orange" label="Total Diskon" value={formatRupiah(s.total_discount || 0)} />
        <StatCard icon={Wallet} tone="purple" label="Rata-rata / Transaksi" value={formatRupiah(s.avg_transaction || 0)} />
        <StatCard icon={ShoppingCart} tone="blue" label="Rata-rata Item / Transaksi" value={formatNumber(Number(s.avg_items_per_transaction || 0).toFixed(1))} />
      </div>

      <div className="card chart-card mb-4">
        <div className="chart-card__title">
          Penjualan per {r.period === "daily" ? "Hari" : r.period === "weekly" ? "Minggu" : "Bulan"}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={r.salesChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="period"
              stroke="var(--text-muted)"
              fontSize={11}
              tickFormatter={(v) => formatChartPeriod(v, r.period)}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={11}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-light)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v) => formatChartPeriod(v, r.period)}
              formatter={(v) => formatRupiah(v)}
            />
            <Bar dataKey="revenue" name="Penjualan" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="chart-card__title">Ringkasan per Periode</div>
        {rows.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Belum ada data penjualan"
            description="Coba ubah rentang tanggal atau periode"
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Transaksi</th>
                  <th>Item Terjual</th>
                  <th>Penjualan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>{formatChartPeriod(row.period, r.period)}</td>
                    <td>{row.transaction_count ?? row.transactions ?? 0}</td>
                    <td>{formatQty(row.total_items_qty ?? row.item_qty ?? 0)}</td>
                    <td className="font-mono">{formatRupiah(row.revenue ?? row.total_revenue ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export function buildSalesPeriodExportPayload(r) {
  const rep = r.salesReport;
  if (!rep) return null;
  const s = rep.summary || {};
  const rows = (rep.salesData || []).map((row) => ({
    period: formatChartPeriod(row.period, r.period),
    transactions: row.transaction_count ?? row.transactions ?? 0,
    item_qty: formatQty(row.total_items_qty ?? row.item_qty ?? 0),
    revenue: formatRupiah(row.revenue ?? row.total_revenue ?? 0),
  }));
  return {
    title: "Laporan Penjualan Periode",
    periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
    columns: [
      { key: "period", label: "Periode" },
      { key: "transactions", label: "Transaksi" },
      { key: "item_qty", label: "Item Terjual" },
      { key: "revenue", label: "Penjualan" },
    ],
    rows,
    summary: [
      { label: "Total Transaksi", value: s.total_transactions || 0 },
      { label: "Total Item Terjual", value: formatQty(s.total_items_qty || 0) },
      { label: "Total Pendapatan", value: formatRupiah(s.total_revenue || 0) },
      { label: "Total Diskon", value: formatRupiah(s.total_discount || 0) },
    ],
  };
}