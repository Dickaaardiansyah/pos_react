// src/features/reports/ReportsPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan. Laporan dipisah per modul/fungsi:
//   penjualan/ · kas/ · produk/ · pembelian/ · piutang/
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronLeft } from "lucide-react";
import { useReports } from "./hooks";
import { PageLoader } from "../../components/UI";
import ReportPicker from "./components/ReportPicker";
import ReportFilterBar from "./components/ReportFilterBar";
import ReportActions from "./components/ReportActions";
import ReportContent from "./components/ReportContent";

export default function Reports() {
  const r = useReports();
  const activeType = r.reportTypes.find((rt) => rt.id === r.reportType);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{activeType ? activeType.title : "Laporan"}</div>
          <div className="page-subtitle">
            {activeType ? activeType.description : "Penjualan, kas, produk, pembelian, hutang & piutang"}
          </div>
        </div>
      </div>

      <div className="page-body">
        {!r.reportType ? (
          <ReportPicker reportTypes={r.reportTypes} onSelect={r.selectReportType} />
        ) : (
          <>
            <div className="report-toolbar">
              <button className="btn btn-ghost btn-sm report-toolbar__back" onClick={r.backToPicker}>
                <ChevronLeft size={14} /> Jenis laporan lain
              </button>
              <div className="report-toolbar__filters">
                <ReportFilterBar r={r} />
              </div>
              <div className="report-toolbar__actions">
                <ReportActions r={r} />
              </div>
            </div>
            {r.loading ? <PageLoader /> : <ReportContent r={r} />}
          </>
        )}
      </div>
    </div>
  );
}
