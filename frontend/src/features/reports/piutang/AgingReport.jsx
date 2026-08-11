// src/features/reports/piutang/AgingReport.jsx
import { Clock, AlertTriangle, CreditCard, CheckCircle2 } from "lucide-react";
import { StatCard, EmptyState, Badge } from "../../../components/UI";
import { formatRupiah, formatDate } from "../../../utils/format";

const BUCKET_LABEL = {
  belum_jatuh_tempo: "Belum Jatuh Tempo",
  "1-30": "1–30 Hari",
  "31-60": "31–60 Hari",
  "61-90": "61–90 Hari",
  "90+": "Lebih dari 90 Hari",
};
const BUCKET_VARIANT = {
  belum_jatuh_tempo: "green",
  "1-30": "orange",
  "31-60": "orange",
  "61-90": "red",
  "90+": "red",
};

function bucketSummary(list) {
  const map = { belum_jatuh_tempo: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  list.forEach((row) => {
    const b = row.bucket || "belum_jatuh_tempo";
    if (map[b] !== undefined) map[b] += Number(row.sisa_tagihan || 0);
  });
  return map;
}

export function AgingContent({ r }) {
  const list = r.piutangAgingReport?.data || [];
  const buckets = bucketSummary(list);
  const totalSisa = list.reduce((s, x) => s + Number(x.sisa_tagihan || 0), 0);
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={CreditCard} tone="blue" label="Total Piutang" value={formatRupiah(totalSisa)} />
        <StatCard icon={CheckCircle2} tone="green" label="Belum Jatuh Tempo" value={formatRupiah(buckets.belum_jatuh_tempo)} />
        <StatCard icon={Clock} tone="orange" label="1–30 Hari" value={formatRupiah(buckets["1-30"])} />
        <StatCard icon={AlertTriangle} tone="red" label="> 30 Hari" value={formatRupiah(buckets["31-60"] + buckets["61-90"] + buckets["90+"])} />
      </div>
      <div className="card mb-4">
        <div className="chart-card__title">Ringkasan per Bucket Umur</div>
        <div className="table-container">
          <table>
            <thead><tr><th>Umur Piutang</th><th>Jumlah Faktur</th><th>Total Sisa</th></tr></thead>
            <tbody>
              {Object.keys(BUCKET_LABEL).map((key) => (
                <tr key={key}>
                  <td><Badge variant={BUCKET_VARIANT[key]}>{BUCKET_LABEL[key]}</Badge></td>
                  <td className="font-mono">{list.filter((x) => x.bucket === key).length}</td>
                  <td className="font-mono">{formatRupiah(buckets[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="chart-card__title">Detail Faktur (Umur Piutang)</div>
        {list.length === 0 ? (
          <EmptyState icon={Clock} title="Tidak ada data aging" description="Tidak ada faktur outstanding" />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>No. Faktur</th><th>Pelanggan</th><th>Jatuh Tempo</th><th>Hari Terlambat</th>
                  <th>Umur</th><th>Total</th><th>Dibayar</th><th>Sisa</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono text-sm">{row.invoice_code || "-"}</td>
                    <td>{row.customer_name || "-"}</td>
                    <td>{formatDate(row.due_date)}</td>
                    <td className="font-mono">{Number(row.hari_terlambat) > 0 ? `${row.hari_terlambat} hari` : "-"}</td>
                    <td><Badge variant={BUCKET_VARIANT[row.bucket] || "blue"}>{BUCKET_LABEL[row.bucket] || row.bucket || "-"}</Badge></td>
                    <td className="font-mono">{formatRupiah(row.amount)}</td>
                    <td className="font-mono text-success">{formatRupiah(row.paid_amount)}</td>
                    <td className="font-mono">{formatRupiah(row.sisa_tagihan)}</td>
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

export function buildAgingExportPayload(r) {
  const list = r.piutangAgingReport?.data || [];
  const rows = list.map((row) => ({
    invoice: row.invoice_code || "-",
    pelanggan: row.customer_name || "-",
    jatuh_tempo: formatDate(row.due_date),
    hari_terlambat: Number(row.hari_terlambat) > 0 ? row.hari_terlambat : 0,
    umur: BUCKET_LABEL[row.bucket] || row.bucket || "-",
    total: formatRupiah(row.amount),
    dibayar: formatRupiah(row.paid_amount),
    sisa: formatRupiah(row.sisa_tagihan),
  }));
  const totalSisa = list.reduce((s, x) => s + Number(x.sisa_tagihan || 0), 0);
  return {
    title: "Laporan Umur Piutang (Aging)",
    periodLabel: "Semua faktur outstanding",
    columns: [
      { key: "invoice", label: "No. Faktur" },
      { key: "pelanggan", label: "Pelanggan" },
      { key: "jatuh_tempo", label: "Jatuh Tempo" },
      { key: "hari_terlambat", label: "Hari Terlambat" },
      { key: "umur", label: "Umur" },
      { key: "total", label: "Total" },
      { key: "dibayar", label: "Dibayar" },
      { key: "sisa", label: "Sisa" },
    ],
    rows,
    summary: [
      { label: "Jumlah Faktur", value: list.length },
      { label: "Total Sisa Piutang", value: formatRupiah(totalSisa) },
    ],
  };
}
