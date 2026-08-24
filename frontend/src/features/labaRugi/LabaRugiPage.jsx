// src/features/labaRugi/LabaRugiPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — Laporan Laba Rugi (Income Statement) & Biaya Operasional.
// Menyediakan 5 jenis laporan agar user mudah memilih laporan yang sesuai
// kebutuhannya: Standar, Multi Year, Kuartal, Multi Periode, dan
// Perbandingan Periode — meniru pola pemilihan laporan pada software
// akuntansi (mis. Accurate/Jurnal). Halaman ini hanya menyusun tata letak —
// seluruh state ada di useLabaRugi, dan setiap bagian tampilan adalah
// komponen presentasional di ./components.
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronLeft, FileBarChart2 } from "lucide-react";
import { useLabaRugi } from "./hooks";
import { PageLoader } from "../../components/UI";
import ReportPicker from "./components/ReportPicker";
import ReportFilterBar from "./components/ReportFilterBar";
import ReportActions from "./components/ReportActions";
import ReportContent from "./components/ReportContent";
import ExpensesTab from "./components/ExpensesTab";

export default function LabaRugi() {
  const lr = useLabaRugi();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Laporan Laba Rugi</div>
          <div className="page-subtitle">Analisis profitabilitas &amp; biaya operasional toko</div>
        </div>
        {lr.tab === "statement" && lr.reportType && (
          <ReportActions lr={lr} />
        )}
      </div>

      <div className="page-body">
        <div className="tab-nav">
          <button className={`tab-btn ${lr.tab === "statement" ? "active" : ""}`} onClick={() => lr.setTab("statement")}>
            <FileBarChart2 size={14} /> Laporan Laba Rugi
          </button>
          <button className={`tab-btn ${lr.tab === "expenses" ? "active" : ""}`} onClick={() => lr.setTab("expenses")}>
            Biaya Operasional
          </button>
        </div>

        {lr.tab === "expenses" ? (
          <ExpensesTab lr={lr} />
        ) : !lr.reportType ? (
          <ReportPicker lr={lr} />
        ) : (
          <>
            <button className="btn btn-ghost btn-sm mb-3" onClick={lr.backToPicker}>
              <ChevronLeft size={14} /> Pilih jenis laporan lain
            </button>
            <ReportFilterBar lr={lr} />
            {lr.loading ? <PageLoader /> : <ReportContent lr={lr} />}
          </>
        )}
      </div>
    </div>
  );
}