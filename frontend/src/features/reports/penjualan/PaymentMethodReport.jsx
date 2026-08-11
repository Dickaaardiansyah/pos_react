// src/features/reports/penjualan/PaymentMethodReport.jsx
import { CreditCard, Receipt, Percent, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { StatCard, EmptyState } from "../../../components/UI";
import { formatRupiah, formatDate, formatNumber } from "../../../utils/format";

export function PaymentMethodContent({ r }) {
  const list = r.paymentMethodReport?.data || [];
  const summary = r.paymentMethodReport?.summary || {};
  const total = Number(summary.total_amount || 0);
  const chartData = list.map((x) => ({
    name: x.payment_method_label || x.payment_method,
    total: x.total_amount,
    count: x.transaction_count,
  }));
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Receipt} tone="blue" label="Total Transaksi" value={summary.total_transactions || 0} />
        <StatCard icon={Wallet} tone="green" label="Total Omzet" value={formatRupiah(total)} />
        <StatCard icon={CreditCard} tone="orange" label="Jumlah Metode" value={summary.method_count || list.length} />
        <StatCard icon={Percent} tone="blue" label="Total Diskon" value={formatRupiah(summary.total_discount || 0)} />
      </div>
      {chartData.length > 0 && (
        <div className="card mb-4">
          <div className="chart-card__title">Omzet per Metode Pembayaran</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => formatRupiah(v)}
                />
                <Bar dataKey="total" fill="var(--primary, #1c4b9b)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="card">
        <div className="chart-card__title">Rekap Metode Pembayaran</div>
        {list.length === 0 ? (
          <EmptyState icon={CreditCard} title="Tidak ada data" description="Coba ubah rentang tanggal" />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Metode</th><th>Jumlah Transaksi</th><th>Total Omzet</th>
                  <th>Rata-rata</th><th>Total Diskon</th><th>Persentase</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => {
                  const pct = total > 0 ? (row.total_amount / total) * 100 : 0;
                  return (
                    <tr key={row.payment_method}>
                      <td>{row.payment_method_label || row.payment_method}</td>
                      <td className="font-mono">{row.transaction_count}</td>
                      <td className="font-mono">{formatRupiah(row.total_amount)}</td>
                      <td className="font-mono">{formatRupiah(row.avg_amount)}</td>
                      <td className="font-mono">{formatRupiah(row.total_discount)}</td>
                      <td className="font-mono">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export function buildPaymentMethodExportPayload(r) {
  const list = r.paymentMethodReport?.data || [];
  const summary = r.paymentMethodReport?.summary || {};
  const total = Number(summary.total_amount || 0);
  const rows = list.map((row) => ({
    metode: row.payment_method_label || row.payment_method,
    jumlah: row.transaction_count,
    omzet: formatRupiah(row.total_amount),
    rata_rata: formatRupiah(row.avg_amount),
    diskon: formatRupiah(row.total_discount),
    persen: total > 0 ? `${((row.total_amount / total) * 100).toFixed(1)}%` : "0%",
  }));
  return {
    title: "Laporan Metode Pembayaran",
    periodLabel: r.startDate && r.endDate ? `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` : "Semua",
    columns: [
      { key: "metode", label: "Metode" },
      { key: "jumlah", label: "Jumlah Transaksi" },
      { key: "omzet", label: "Total Omzet" },
      { key: "rata_rata", label: "Rata-rata" },
      { key: "diskon", label: "Total Diskon" },
      { key: "persen", label: "Persentase" },
    ],
    rows,
    summary: [
      { label: "Total Transaksi", value: summary.total_transactions || 0 },
      { label: "Total Omzet", value: formatRupiah(total) },
    ],
  };
}
