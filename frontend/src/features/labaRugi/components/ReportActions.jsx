// src/features/labaRugi/components/ReportActions.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Tombol cetak / ekspor PDF / ekspor Excel, menyesuaikan jenis
// laporan Laba Rugi yang sedang aktif.
// ─────────────────────────────────────────────────────────────────────────────
import toast from "react-hot-toast";
import { Printer, FileDown, FileSpreadsheet } from "lucide-react";
import { formatDate } from "../../../utils/format";
import {
  printLabaRugiReport, exportLabaRugiPDF, exportLabaRugiExcel,
  printMultiColumnLabaRugi, exportMultiColumnLabaRugiExcel,
  printComparisonLabaRugi, exportComparisonLabaRugiExcel,
} from "../../../utils/printLabaRugi";

export default function ReportActions({ lr }) {
  const t = lr.reportType;

  function handlePrint() {
    if (t === "standard" && lr.statement) {
      printLabaRugiReport(lr.statement, lr.storeSettings);
    } else if (t === "multiYear" && lr.multiYearReport) {
      const r = lr.multiYearReport;
      printMultiColumnLabaRugi({
        title: "Laba/Rugi (Multi Year)",
        periodLabel: `per ${r.end_year}`,
        columns: [...r.periods, { label: "Total", summary: r.total }],
        storeSettings: lr.storeSettings,
      });
    } else if (t === "quarterly" && lr.quarterlyReport) {
      const r = lr.quarterlyReport;
      printMultiColumnLabaRugi({
        title: "Laba/Rugi (Kuartal)",
        periodLabel: `Tahun ${r.year}`,
        columns: [...r.periods, { label: "Total", summary: r.total }],
        storeSettings: lr.storeSettings,
      });
    } else if (t === "multiPeriod" && lr.multiPeriodReport) {
      const r = lr.multiPeriodReport;
      printMultiColumnLabaRugi({
        title: "Laba/Rugi (Multi Periode)",
        periodLabel: `Tanggal ${formatDate(r.period.startDate)} - ${formatDate(r.period.endDate)}`,
        columns: [...r.periods, { label: "Total", summary: r.total }],
        storeSettings: lr.storeSettings,
      });
    } else if (t === "comparison" && lr.comparisonReport) {
      printComparisonLabaRugi({ ...lr.comparisonReport, storeSettings: lr.storeSettings });
    }
  }

  async function handleExportExcel() {
    try {
      if (t === "standard" && lr.statement) {
        await exportLabaRugiExcel(lr.statement, lr.storeSettings);
      } else if (t === "multiYear" && lr.multiYearReport) {
        const r = lr.multiYearReport;
        await exportMultiColumnLabaRugiExcel({
          title: "Laba/Rugi (Multi Year)", periodLabel: `per ${r.end_year}`,
          columns: [...r.periods, { label: "Total", summary: r.total }],
          storeSettings: lr.storeSettings, filename: `Laba_Rugi_Multi_Year_${r.end_year}.xlsx`,
        });
      } else if (t === "quarterly" && lr.quarterlyReport) {
        const r = lr.quarterlyReport;
        await exportMultiColumnLabaRugiExcel({
          title: "Laba/Rugi (Kuartal)", periodLabel: `Tahun ${r.year}`,
          columns: [...r.periods, { label: "Total", summary: r.total }],
          storeSettings: lr.storeSettings, filename: `Laba_Rugi_Kuartal_${r.year}.xlsx`,
        });
      } else if (t === "multiPeriod" && lr.multiPeriodReport) {
        const r = lr.multiPeriodReport;
        await exportMultiColumnLabaRugiExcel({
          title: "Laba/Rugi (Multi Periode)", periodLabel: `${r.period.startDate} s/d ${r.period.endDate}`,
          columns: [...r.periods, { label: "Total", summary: r.total }],
          storeSettings: lr.storeSettings, filename: `Laba_Rugi_Multi_Periode.xlsx`,
        });
      } else if (t === "comparison" && lr.comparisonReport) {
        await exportComparisonLabaRugiExcel({ ...lr.comparisonReport, storeSettings: lr.storeSettings });
      }
    } catch {
      toast.error("Gagal membuat Excel");
    }
  }

  return (
    <div className="flex gap-2">
      <button className="btn btn-ghost btn-sm" onClick={handlePrint}>
        <Printer size={14} /> Cetak
      </button>
      {t === "standard" && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            try { await exportLabaRugiPDF(lr.statement, lr.storeSettings); }
            catch { toast.error("Gagal membuat PDF"); }
          }}
        >
          <FileDown size={14} /> Export PDF
        </button>
      )}
      <button className="btn btn-ghost btn-sm" onClick={handleExportExcel}>
        <FileSpreadsheet size={14} /> Export Excel
      </button>
    </div>
  );
}