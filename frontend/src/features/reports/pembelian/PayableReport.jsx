// src/features/reports/pembelian/PayableReport.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Hutang Supplier (modul Pembelian).
// Daftar hutang: supplier, total hutang, jatuh tempo, status.
// Sumber: payablesApi (list / unpaid-per-supplier / summary).
// ─────────────────────────────────────────────────────────────────────────────
import { CreditCard, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
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

export function PayableReportContent({ r }) {
  const list = r.payableReport?.data || [];
  const summary = r.payableReport?.summary || {};
  const bySupplier = r.payableReport?.bySupplier || [];

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={CreditCard} tone="blue" label="Total Hutang" value={formatRupiah(summary.total_outstanding || summary.total_amount || 0)} />
        <StatCard icon={Clock} tone="orange" label="Belum Lunas" value={summary.count_unpaid || list.filter((x) => x.status !== "lunas").length || 0} />
        <StatCard icon={AlertTriangle} tone="red" label="Jatuh Tempo" value={summary.count_overdue || list.filter((x) => isOverdue(x.due_date, x.status)).length || 0} />
        <StatCard icon={CheckCircle2} tone="green" label="Lunas" value={summary.count_paid || list.filter((x) => x.status === "lunas").length || 0} />
      </div>

      {bySupplier.length > 0 && (
        <div className="card mb-4">
          <div className="chart-card__title">Hutang per Supplier</div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Total Hutang</th>
                  <th>Jumlah Faktur</th>
                </tr>
              </thead>
              <tbody>
                {bySupplier.map((s, i) => (
                  <tr key={s.supplier_id || i}>
                    <td>{s.supplier_name || s.name}</td>
                    <td className="font-mono">{formatRupiah(s.total_outstanding || s.total_amount || 0)}</td>
                    <td>{s.invoice_count || s.count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="chart-card__title">Daftar Hutang Supplier</div>
        {list.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Tidak ada hutang"
            description="Semua hutang sudah lunas atau belum ada pembelian kredit"
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Invoice</th>
                  <th>Total Hutang</th>
                  <th>Dibayar</th>
                  <th>Sisa</th>
                  <th>Jatuh Tempo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const amount = Number(p.amount || 0);
                  const paid = Number(p.paid_amount || 0);
                  const remaining = Math.max(0, amount - paid);
                  const overdue = isOverdue(p.due_date, p.status);
                  return (
                    <tr key={p.id}>
                      <td>{p.supplier_name || "-"}</td>
                      <td className="font-mono text-sm">{p.invoice_code || p.invoice_no || "-"}</td>
                      <td className="font-mono">{formatRupiah(amount)}</td>
                      <td className="font-mono text-success">{formatRupiah(paid)}</td>
                      <td className="font-mono">{formatRupiah(remaining)}</td>
                      <td>
                        {formatDate(p.due_date)}
                        {overdue && (
                          <Badge variant="red" className="ml-1">
                            Jatuh Tempo
                          </Badge>
                        )}
                      </td>
                      <td>
                        <Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge>
                      </td>
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

export function buildPayableReportExportPayload(r) {
  const list = r.payableReport?.data || [];
  const summary = r.payableReport?.summary || {};
  const rows = list.map((p) => {
    const amount = Number(p.amount || 0);
    const paid = Number(p.paid_amount || 0);
    return {
      supplier: p.supplier_name || "-",
      invoice: p.invoice_code || p.invoice_no || "-",
      total_hutang: formatRupiah(amount),
      dibayar: formatRupiah(paid),
      sisa: formatRupiah(Math.max(0, amount - paid)),
      jatuh_tempo: formatDate(p.due_date),
      status: statusLabel(p.status),
    };
  });
  return {
    title: "Laporan Hutang Supplier",
    periodLabel: r.startDate && r.endDate ? `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` : "Semua",
    columns: [
      { key: "supplier", label: "Supplier" },
      { key: "invoice", label: "Invoice" },
      { key: "total_hutang", label: "Total Hutang" },
      { key: "dibayar", label: "Dibayar" },
      { key: "sisa", label: "Sisa" },
      { key: "jatuh_tempo", label: "Jatuh Tempo" },
      { key: "status", label: "Status" },
    ],
    rows,
    summary: [
      { label: "Total Hutang", value: formatRupiah(summary.total_outstanding || summary.total_amount || 0) },
      { label: "Belum Lunas", value: summary.count_unpaid || list.filter((x) => x.status !== "lunas").length || 0 },
      { label: "Lunas", value: summary.count_paid || list.filter((x) => x.status === "lunas").length || 0 },
    ],
  };
}