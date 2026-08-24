// src/features/labaRugi/components/ReportContent.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Konten laporan, sesuai jenis yang aktif — meneruskan ke komponen statement
// yang sesuai (Standar, Multi Year/Kuartal/Multi Periode, atau Perbandingan).
// ─────────────────────────────────────────────────────────────────────────────
import { PageLoader } from "../../../components/UI";
import { formatDate } from "../../../utils/format";
import StatementTab from "./StatementTab";
import MultiColumnStatement from "./MultiColumnStatement";
import ComparisonStatement from "./ComparisonStatement";

export default function ReportContent({ lr }) {
  const t = lr.reportType;
  if (t === "standard") return <StatementTab lr={lr} />;
  if (t === "multiYear" && lr.multiYearReport) {
    const r = lr.multiYearReport;
    return (
      <MultiColumnStatement
        title={`Laba/Rugi (Multi Year)`}
        subtitle={`per ${r.end_year} · ${r.years} tahun terakhir`}
        columns={[...r.periods, { label: "Total", summary: r.total }]}
      />
    );
  }
  if (t === "quarterly" && lr.quarterlyReport) {
    const r = lr.quarterlyReport;
    return (
      <MultiColumnStatement
        title={`Laba/Rugi (Kuartal)`}
        subtitle={`Tahun ${r.year}`}
        columns={[...r.periods, { label: "Total", summary: r.total }]}
      />
    );
  }
  if (t === "multiPeriod" && lr.multiPeriodReport) {
    const r = lr.multiPeriodReport;
    return (
      <MultiColumnStatement
        title={`Laba/Rugi (Multi Periode)`}
        subtitle={`${formatDate(r.period.startDate)} – ${formatDate(r.period.endDate)}`}
        columns={[...r.periods, { label: "Total", summary: r.total }]}
      />
    );
  }
  if (t === "comparison" && lr.comparisonReport) {
    return <ComparisonStatement report={lr.comparisonReport} />;
  }
  return <PageLoader />;
}