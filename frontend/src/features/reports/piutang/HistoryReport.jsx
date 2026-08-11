// src/features/reports/piutang/HistoryReport.jsx
import { History, CreditCard, Receipt } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";

const METHOD_LABEL = {
  cash: "Tunai", transfer: "Transfer", qris: "QRIS", debit: "Debit",
  credit: "Kredit", ewallet: "E-Wallet", tunai: "Tunai",
};

export function HistoryContent({ r }) {
  const list = r.piutangHistoryReport?.data || [];
  const totalBayar = list.reduce((s, x) => s + Number(x.amount || 0), 0);
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Receipt} tone="blue" label="Jumlah Pembayaran" value={list.length} />
        <StatCard icon={CreditCard} tone="green" label="Total Diterima" value={formatRupiah(totalBayar)} />
        <StatCard
          icon={History}
          tone="orange"
          label="Periode"
          value={r.startDate && r.endDate ? `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` : "Semua"}
        />
      </div>
      <div className="card">
        <div className="chart-card__title">Riwayat Pembayaran Piutang</div>
        {list.length === 0 ? (
          <EmptyState icon={History} title="Tidak ada riwayat pembayaran" description="Coba ubah filter tanggal atau pelanggan" />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tanggal Bayar</th><th>No. Faktur</th><th>Pelanggan</th>
                  <th>Total Tagihan</th><th>Jumlah Bayar</th><th>Metode</th><th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.payment_date)}</td>
                    <td className="font-mono text-sm">{row.invoice_code || "-"}</td>
                    <td>{row.customer_name || "-"}</td>
                    <td className="font-mono">{formatRupiah(row.total_tagihan)}</td>
                    <td className="font-mono text-success">{formatRupiah(row.amount)}</td>
                    <td><Badge variant="blue">{METHOD_LABEL[row.payment_method] || row.payment_method || "-"}</Badge></td>
                    <td className="text-sm text-muted">{row.notes || "-"}</td>
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

export function buildHistoryExportPayload(r) {
  const list = r.piutangHistoryReport?.data || [];
  const rows = list.map((row) => ({
    tanggal: formatDate(row.payment_date),
    invoice: row.invoice_code || "-",
    pelanggan: row.customer_name || "-",
    total_tagihan: formatRupiah(row.total_tagihan),
    jumlah_bayar: formatRupiah(row.amount),
    metode: METHOD_LABEL[row.payment_method] || row.payment_method || "-",
    catatan: row.notes || "-",
  }));
  const totalBayar = list.reduce((s, x) => s + Number(x.amount || 0), 0);
  return {
    title: "Laporan Riwayat Pembayaran Piutang",
    periodLabel: r.startDate && r.endDate ? `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` : "Semua periode",
    columns: [
      { key: "tanggal", label: "Tanggal Bayar" },
      { key: "invoice", label: "No. Faktur" },
      { key: "pelanggan", label: "Pelanggan" },
      { key: "total_tagihan", label: "Total Tagihan" },
      { key: "jumlah_bayar", label: "Jumlah Bayar" },
      { key: "metode", label: "Metode" },
      { key: "catatan", label: "Catatan" },
    ],
    rows,
    summary: [
      { label: "Jumlah Pembayaran", value: list.length },
      { label: "Total Diterima", value: formatRupiah(totalBayar) },
    ],
  };
}
