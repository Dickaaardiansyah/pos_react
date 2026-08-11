// src/features/reports/piutang/UnpaidByCustomerReport.jsx
import { Users, CreditCard, FileText, Clock } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";

export function UnpaidByCustomerContent({ r }) {
  const list = r.piutangPerCustomerReport?.data || [];
  const summary = r.piutangPerCustomerReport?.summary || {};
  const totalSisa = list.reduce((s, x) => s + Number(x.total_sisa || 0), 0);
  const totalFaktur = list.reduce((s, x) => s + Number(x.total_faktur || 0), 0);
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={Users} tone="blue" label="Jumlah Pelanggan" value={list.length} />
        <StatCard icon={FileText} tone="orange" label="Total Faktur" value={summary.total_faktur_belum_lunas ?? totalFaktur} />
        <StatCard icon={CreditCard} tone="red" label="Total Piutang" value={formatRupiah(summary.total_piutang ?? totalSisa)} />
        <StatCard icon={Clock} tone="red" label="Nilai Jatuh Tempo" value={formatRupiah(summary.total_jatuh_tempo || 0)} />
      </div>
      <div className="card">
        <div className="chart-card__title">Daftar Pelanggan & Sisa Piutang</div>
        {list.length === 0 ? (
          <EmptyState icon={Users} title="Tidak ada pelanggan dengan piutang" description="Semua piutang sudah lunas atau belum ada data" />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Pelanggan</th><th>Jumlah Faktur</th><th>Total Tagihan</th>
                  <th>Total Dibayar</th><th>Sisa Piutang</th><th>Jatuh Tempo Terdekat</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, i) => {
                  const due = row.jatuh_tempo_terdekat;
                  const overdue = due && new Date(due) < new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <tr key={`${row.customer_id}-${i}`}>
                      <td>{i + 1}</td>
                      <td>{row.customer_name || "-"}</td>
                      <td className="font-mono">{row.total_faktur ?? 0}</td>
                      <td className="font-mono">{formatRupiah(row.total_tagihan)}</td>
                      <td className="font-mono text-success">{formatRupiah(row.total_dibayar)}</td>
                      <td className="font-mono">{formatRupiah(row.total_sisa)}</td>
                      <td>
                        {formatDate(due)}
                        {overdue && <Badge variant="red" className="ml-1">Jatuh Tempo</Badge>}
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

export function buildUnpaidByCustomerExportPayload(r) {
  const list = r.piutangPerCustomerReport?.data || [];
  const summary = r.piutangPerCustomerReport?.summary || {};
  const rows = list.map((row, i) => ({
    no: i + 1,
    pelanggan: row.customer_name || "-",
    jumlah_faktur: row.total_faktur ?? 0,
    total_tagihan: formatRupiah(row.total_tagihan),
    total_dibayar: formatRupiah(row.total_dibayar),
    sisa: formatRupiah(row.total_sisa),
    jatuh_tempo: formatDate(row.jatuh_tempo_terdekat),
  }));
  return {
    title: "Laporan Piutang per Pelanggan",
    periodLabel: "Semua pelanggan dengan sisa piutang",
    columns: [
      { key: "no", label: "#" },
      { key: "pelanggan", label: "Pelanggan" },
      { key: "jumlah_faktur", label: "Jumlah Faktur" },
      { key: "total_tagihan", label: "Total Tagihan" },
      { key: "total_dibayar", label: "Total Dibayar" },
      { key: "sisa", label: "Sisa Piutang" },
      { key: "jatuh_tempo", label: "Jatuh Tempo Terdekat" },
    ],
    rows,
    summary: [
      { label: "Jumlah Pelanggan", value: list.length },
      { label: "Total Piutang", value: formatRupiah(summary.total_piutang || 0) },
    ],
  };
}
