// src/features/dashboard/components/DashboardDateFilter.jsx
import { FileDown, FileSpreadsheet } from "lucide-react";
import { DASHBOARD_FILTER_OPTIONS, availableYears } from "../hooks";

export default function DashboardDateFilter({
  filterMode, setFilterMode,
  selectedYear, setSelectedYear,
  customStart, setCustomStart,
  customEnd, setCustomEnd,
  onExportPdf, onExportExcel,
}) {
  return (
    <div className="dashboard-filter-bar">
      <div className="dashboard-filter-bar__inputs">
        <select
          className="dashboard-filter-select"
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
        >
          {DASHBOARD_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {filterMode === "year" && (
          <select
            className="dashboard-filter-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {availableYears().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}

        {filterMode === "custom" && (
          <>
            <input
              type="date" className="dashboard-filter-date"
              value={customStart} onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-muted text-sm">s/d</span>
            <input
              type="date" className="dashboard-filter-date"
              value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
            />
          </>
        )}
      </div>

      <div className="dashboard-filter-bar__spacer" />

      <div className="dashboard-export-group">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExportPdf}>
          <FileDown size={14} /> PDF
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExportExcel}>
          <FileSpreadsheet size={14} /> Excel
        </button>
      </div>
    </div>
  );
}
