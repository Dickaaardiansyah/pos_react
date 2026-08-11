// src/features/reports/pembelian/PurchaseReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Pembelian (modul Pembelian).
// Daftar pembelian per periode: tanggal, supplier, invoice, total.
// Memanfaatkan data periodData + summary dari purchaseApi.getReport.
// ─────────────────────────────────────────────────────────────────────────────
import { Truck, ShoppingBag, Package } from "lucide-react";
import { StatCard, EmptyState } from "../../../components/UI";
import { formatRupiah, formatDate, formatChartPeriod, formatQty } from "../../../utils/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function PurchaseReportContent({ r }) {
  const rep = r.purchaseReport;
  if (!rep) return null;
  const s = rep.summary || {};
  const periodRows = rep.periodData || [];
  const list = r.purchaseList || []; // optional detailed list if fetched

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={ShoppingBag} tone="blue" label="Total Transaksi" value={s.total_transactions || s.transaction_count || periodRows.reduce((a, p) => a + (p.transaction_count || 0), 0) || 0} />
        <StatCard icon={Package} tone="cyan" label="Total Qty" value={formatQty(s.total_qty || 0)} />
        <StatCard icon={Truck} tone="green" label="Total Pembelian" value={formatRupiah(s.total_cost || s.total_amount || 0)} />
      </div>

      {r.purchaseChartData?.length > 0 && (
        <div className="card chart-card mb-4">
          <div className="chart-card__title">Pembelian per Periode</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={r.purchaseChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => formatChartPeriod(v, r.period)} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v) => formatChartPeriod(v, r.period)}
                formatter={(v) => formatRupiah(v)}
              />
              <Bar dataKey="cost" name="Total" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card mb-4">
        <div className="chart-card__title">Ringkasan per Periode</div>
        {periodRows.length === 0 ? (
          <EmptyState icon={Truck} title="Belum ada data pembelian" description="Coba ubah rentang tanggal" />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Transaksi</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {periodRows.map((row, i) => (
                  <tr key={i}>
                    <td>{formatChartPeriod(row.period, r.period)}</td>
                    <td>{row.transaction_count || 0}</td>
                    <td>{formatQty(row.total_qty || 0)}</td>
                    <td className="font-mono">{formatRupiah(row.total_cost || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {list.length > 0 && (
        <div className="card">
          <div className="chart-card__title">Daftar Pembelian</div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Supplier</th>
                  <th>Invoice / Kode</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.purchase_date || p.created_at)}</td>
                    <td>{p.supplier_name || "-"}</td>
                    <td className="font-mono text-sm">{p.purchase_code || p.invoice_no || p.id}</td>
                    <td className="font-mono">{formatRupiah(p.total_amount || p.total_cost || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export function buildPurchaseReportExportPayload(r) {
  const rep = r.purchaseReport;
  if (!rep) return null;
  const s = rep.summary || {};
  const rows = (rep.periodData || []).map((row) => ({
    periode: formatChartPeriod(row.period, r.period),
    transaksi: row.transaction_count || 0,
    qty: formatQty(row.total_qty || 0),
    total: formatRupiah(row.total_cost || 0),
  }));
  return {
    title: "Laporan Pembelian",
    periodLabel: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
    columns: [
      { key: "periode", label: "Periode" },
      { key: "transaksi", label: "Transaksi" },
      { key: "qty", label: "Qty" },
      { key: "total", label: "Total" },
    ],
    rows,
    summary: [
      { label: "Total Transaksi", value: s.total_transactions || s.transaction_count || 0 },
      { label: "Total Qty", value: formatQty(s.total_qty || 0) },
      { label: "Total Pembelian", value: formatRupiah(s.total_cost || s.total_amount || 0) },
    ],
  };
}