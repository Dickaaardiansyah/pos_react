// src/features/labaRugi/components/ReportFilterBar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION — Filter bar yang menyesuaikan jenis laporan aktif (rentang
// tanggal, tahun, kuartal, atau dua periode untuk perbandingan).
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportFilterBar({ lr }) {
  const t = lr.reportType;

  if (t === "standard") {
    return (
      <div className="filter-bar">
        <input type="date" className="form-input" value={lr.startDate} onChange={(e) => lr.setStartDate(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={lr.endDate} onChange={(e) => lr.setEndDate(e.target.value)} />
      </div>
    );
  }

  if (t === "multiYear") {
    return (
      <div className="filter-bar">
        <span className="text-muted text-sm">Tahun akhir</span>
        <input
          type="number" className="form-input" style={{ width: 100 }}
          value={lr.multiYearEndYear}
          onChange={(e) => lr.setMultiYearEndYear(Number(e.target.value) || lr.multiYearEndYear)}
        />
        <span className="text-muted text-sm">Jumlah tahun</span>
        <select className="form-select" style={{ width: 90 }} value={lr.multiYearSpan} onChange={(e) => lr.setMultiYearSpan(Number(e.target.value))}>
          {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} thn</option>)}
        </select>
      </div>
    );
  }

  if (t === "quarterly") {
    return (
      <div className="filter-bar">
        <span className="text-muted text-sm">Tahun</span>
        <input
          type="number" className="form-input" style={{ width: 100 }}
          value={lr.quarterlyYear}
          onChange={(e) => lr.setQuarterlyYear(Number(e.target.value) || lr.quarterlyYear)}
        />
      </div>
    );
  }

  if (t === "multiPeriod") {
    return (
      <div className="filter-bar">
        <input type="date" className="form-input" value={lr.multiPeriodStart} onChange={(e) => lr.setMultiPeriodStart(e.target.value)} />
        <span className="text-muted text-sm">s/d</span>
        <input type="date" className="form-input" value={lr.multiPeriodEnd} onChange={(e) => lr.setMultiPeriodEnd(e.target.value)} />
      </div>
    );
  }

  if (t === "comparison") {
    return (
      <div className="filter-bar flex-col items-start gap-2">
        <div className="flex gap-2 items-center">
          <span className="text-muted text-sm" style={{ width: 70 }}>Periode 1</span>
          <input type="date" className="form-input" value={lr.period1Start} onChange={(e) => lr.setPeriod1Start(e.target.value)} />
          <span className="text-muted text-sm">s/d</span>
          <input type="date" className="form-input" value={lr.period1End} onChange={(e) => lr.setPeriod1End(e.target.value)} />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-muted text-sm" style={{ width: 70 }}>Periode 2</span>
          <input type="date" className="form-input" value={lr.period2Start} onChange={(e) => lr.setPeriod2Start(e.target.value)} />
          <span className="text-muted text-sm">s/d</span>
          <input type="date" className="form-input" value={lr.period2End} onChange={(e) => lr.setPeriod2End(e.target.value)} />
        </div>
      </div>
    );
  }

  return null;
}