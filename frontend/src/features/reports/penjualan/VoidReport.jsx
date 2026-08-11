// src/features/reports/penjualan/VoidReport.jsx
import { Ban, Receipt, AlertTriangle, User } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";

export function VoidReportContent({ r }) {
  const list = r.voidReport?.data || [];
  const summary = r.voidReport?.summary || {};
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Ban} tone="red" label="Jumlah Void" value={summary.total_void || list.length} />
        <StatCard icon={Receipt} tone="orange" label="Nilai Dibatalkan" value={formatRupiah(summary.total_amount || 0)} />
        <StatCard icon={User} tone="blue" label="Filter Kasir" value={r.cashierFilter || "Semua"} />
        <StatCard icon={AlertTriangle} tone="red" label="Periode" value={
          r.startDate && r.endDate ? `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` : "Semua"
        } />
      </div>
      <div className="card">
        <div className="chart-card__title">Daftar Transaksi Dibatalkan (Void)</div>
        {list.length === 0 ? (
          <EmptyState icon={Ban} title="Tidak ada transaksi void" description="Coba ubah filter tanggal atau kasir" />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Kode Transaksi</th><th>Waktu Transaksi</th><th>Waktu Void</th>
                  <th>Kasir</th><th>Dibatalkan Oleh</th><th>Pelanggan</th>
                  <th>Metode</th><th>Nilai</th><th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono text-sm">{row.transaction_code}</td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>{formatDate(row.voided_at)}</td>
                    <td>{row.cashier_name || "-"}</td>
                    <td>{row.voided_by || "-"}</td>
                    <td>{row.customer_name || "-"}</td>
                    <td><Badge variant="blue">{row.payment_method_label || row.payment_method || "-"}</Badge></td>
                    <td className="font-mono">{formatRupiah(row.final_amount)}</td>
                    <td className="text-sm">{row.void_reason || "-"}</td>
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

export function buildVoidReportExportPayload(r) {
  const list = r.voidReport?.data || [];
  const summary = r.voidReport?.summary || {};
  const rows = list.map((row) => ({
    kode: row.transaction_code,
    waktu_tx: formatDate(row.created_at),
    waktu_void: formatDate(row.voided_at),
    kasir: row.cashier_name || "-",
    void_oleh: row.voided_by || "-",
    pelanggan: row.customer_name || "-",
    metode: row.payment_method_label || row.payment_method || "-",
    nilai: formatRupiah(row.final_amount),
    alasan: row.void_reason || "-",
  }));
  return {
    title: "Laporan Transaksi Void / Dibatalkan",
    periodLabel: r.startDate && r.endDate ? `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` : "Semua",
    columns: [
      { key: "kode", label: "Kode Transaksi" },
      { key: "waktu_tx", label: "Waktu Transaksi" },
      { key: "waktu_void", label: "Waktu Void" },
      { key: "kasir", label: "Kasir" },
      { key: "void_oleh", label: "Dibatalkan Oleh" },
      { key: "pelanggan", label: "Pelanggan" },
      { key: "metode", label: "Metode" },
      { key: "nilai", label: "Nilai" },
      { key: "alasan", label: "Alasan" },
    ],
    rows,
    summary: [
      { label: "Jumlah Void", value: summary.total_void || list.length },
      { label: "Nilai Dibatalkan", value: formatRupiah(summary.total_amount || 0) },
    ],
  };
}
