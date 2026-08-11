// src/features/reports/piutang/UnpaidInvoicesReport.jsx
import { CreditCard, AlertTriangle, Clock, FileText } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";

function statusLabel(status) {
  if (status === "lunas") return "Lunas";
  if (status === "sebagian") return "Sebagian";
  if (status === "belum_lunas") return "Belum Lunas";
  return status || "-";
}
function statusVariant(status) {
  if (status === "lunas") return "green";
  if (status === "sebagian") return "orange";
  return "red";
}
function isOverdue(dueDate, status) {
  if (!dueDate || status === "lunas") return false;
  const d = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function UnpaidInvoicesContent({ r }) {
  const list = r.piutangUnpaidReport?.data || [];
  const summary = r.piutangUnpaidReport?.summary || {};
  const overdueCount = list.filter((x) => isOverdue(x.due_date, x.status)).length;
  const totalSisa = list.reduce(
    (s, x) => s + Math.max(0, Number(x.amount || 0) - Number(x.paid_amount || 0)),
    0,
  );
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={FileText} tone="blue" label="Jumlah Faktur" value={summary.total_faktur_belum_lunas ?? list.length} />
        <StatCard icon={CreditCard} tone="orange" label="Total Piutang" value={formatRupiah(summary.total_piutang ?? totalSisa)} />
        <StatCard icon={AlertTriangle} tone="red" label="Jatuh Tempo" value={summary.jumlah_jatuh_tempo ?? overdueCount} />
        <StatCard icon={Clock} tone="red" label="Nilai Jatuh Tempo" value={formatRupiah(summary.total_jatuh_tempo || 0)} />
      </div>
      <div className="card">
        <div className="chart-card__title">Daftar Faktur Belum Lunas</div>
        {list.length === 0 ? (
          <EmptyState icon={FileText} title="Tidak ada faktur belum lunas" description="Coba ubah filter pelanggan atau semua piutang sudah lunas" />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>No. Faktur</th><th>Pelanggan</th><th>Tgl Faktur</th><th>Jatuh Tempo</th>
                  <th>Total</th><th>Dibayar</th><th>Sisa</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => {
                  const amount = Number(row.amount || 0);
                  const paid = Number(row.paid_amount || 0);
                  const sisa = Math.max(0, amount - paid);
                  const overdue = isOverdue(row.due_date, row.status);
                  return (
                    <tr key={row.id}>
                      <td className="font-mono text-sm">{row.invoice_code || "-"}</td>
                      <td>{row.customer_name || "-"}</td>
                      <td>{formatDate(row.invoice_date)}</td>
                      <td>
                        {formatDate(row.due_date)}
                        {overdue && <Badge variant="red" className="ml-1">Jatuh Tempo</Badge>}
                      </td>
                      <td className="font-mono">{formatRupiah(amount)}</td>
                      <td className="font-mono text-success">{formatRupiah(paid)}</td>
                      <td className="font-mono">{formatRupiah(sisa)}</td>
                      <td><Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge></td>
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

export function buildUnpaidInvoicesExportPayload(r) {
  const list = r.piutangUnpaidReport?.data || [];
  const summary = r.piutangUnpaidReport?.summary || {};
  const rows = list.map((row) => {
    const amount = Number(row.amount || 0);
    const paid = Number(row.paid_amount || 0);
    return {
      invoice: row.invoice_code || "-",
      pelanggan: row.customer_name || "-",
      tgl_faktur: formatDate(row.invoice_date),
      jatuh_tempo: formatDate(row.due_date),
      total: formatRupiah(amount),
      dibayar: formatRupiah(paid),
      sisa: formatRupiah(Math.max(0, amount - paid)),
      status: statusLabel(row.status),
    };
  });
  return {
    title: "Laporan Faktur Belum Lunas",
    periodLabel: r.piutangCustomerId ? "Pelanggan terfilter" : "Semua faktur outstanding",
    columns: [
      { key: "invoice", label: "No. Faktur" },
      { key: "pelanggan", label: "Pelanggan" },
      { key: "tgl_faktur", label: "Tgl Faktur" },
      { key: "jatuh_tempo", label: "Jatuh Tempo" },
      { key: "total", label: "Total" },
      { key: "dibayar", label: "Dibayar" },
      { key: "sisa", label: "Sisa" },
      { key: "status", label: "Status" },
    ],
    rows,
    summary: [
      { label: "Jumlah Faktur", value: summary.total_faktur_belum_lunas ?? list.length },
      { label: "Total Piutang", value: formatRupiah(summary.total_piutang || 0) },
      { label: "Jatuh Tempo", value: summary.jumlah_jatuh_tempo ?? 0 },
    ],
  };
}
