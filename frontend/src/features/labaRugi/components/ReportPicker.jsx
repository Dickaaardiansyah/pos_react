// src/features/labaRugi/components/ReportPicker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Grid pemilihan jenis laporan Laba Rugi (Standar, Multi Year,
// Kuartal, Multi Periode, Perbandingan Periode).
// ─────────────────────────────────────────────────────────────────────────────
import { FileBarChart2, CalendarClock, CalendarDays, LineChart as LineChartIcon, GitCompareArrows } from "lucide-react";

const REPORT_ICONS = {
  standard: FileBarChart2,
  multiYear: CalendarClock,
  quarterly: CalendarDays,
  multiPeriod: LineChartIcon,
  comparison: GitCompareArrows,
};

export default function ReportPicker({ lr }) {
  return (
    <div className="report-picker">
      {lr.reportTypes.map((r) => {
        const Icon = REPORT_ICONS[r.id] || FileBarChart2;
        return (
          <button key={r.id} className="report-picker__item" onClick={() => lr.selectReportType(r.id)}>
            <span className="report-picker__icon"><Icon size={22} /></span>
            <span className="report-picker__text">
              <span className="report-picker__title">{r.title}</span>
              <span className="report-picker__desc">{r.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}