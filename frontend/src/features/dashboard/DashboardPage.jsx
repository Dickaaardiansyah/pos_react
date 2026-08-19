// src/features/dashboard/DashboardPage.jsx
import { Package } from "lucide-react";
import toast from "react-hot-toast";
import { useDashboard } from "./hooks";
import { PageLoader } from "../../components/UI";
import { printDashboardReport, exportDashboardExcel } from "../../utils/exportDashboard";
import DashboardHeader from "./components/DashboardHeader";
import DashboardDateFilter from "./components/DashboardDateFilter";
import SalesStatsGrid from "./components/SalesStatsGrid";
import InventoryStatsGrid from "./components/InventoryStatsGrid";
import RevenueChart from "./components/RevenueChart";
import IncomeStatementSummary from "./components/IncomeStatementSummary";
import TopProducts from "./components/TopProducts";
import ExpenseRanking from "./components/ExpenseRanking";
import TransactionChart from "./components/TransactionChart";

export default function Dashboard() {
  const {
    summary, loading, chartData, todayRevenuePct, todayTxPct, incomeStatement, loadingIncome,
    filterMode, setFilterMode, selectedYear, setSelectedYear, customStart, setCustomStart,
    customEnd, setCustomEnd, range, periodSummary, loadingPeriod, storeSettings,
  } = useDashboard();

  if (loading) return <PageLoader text="Memuat dashboard..." />;

  function handleExportPdf() {
    if (!periodSummary) {
      toast.error("Data periode belum siap, coba lagi sebentar");
      return;
    }
    printDashboardReport({ storeSettings, periodLabel: range.label, periodSummary, incomeStatement });
  }

  function handleExportExcel() {
    if (!periodSummary) {
      toast.error("Data periode belum siap, coba lagi sebentar");
      return;
    }
    exportDashboardExcel({ storeSettings, periodLabel: range.label, periodSummary, incomeStatement });
  }

  return (
    <div className="fade-in dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Ringkasan performa toko hari ini</div>
        </div>
        <DashboardHeader />
      </div>

      <div className="page-body">
        <DashboardDateFilter
          filterMode={filterMode} setFilterMode={setFilterMode}
          selectedYear={selectedYear} setSelectedYear={setSelectedYear}
          customStart={customStart} setCustomStart={setCustomStart}
          customEnd={customEnd} setCustomEnd={setCustomEnd}
          onExportPdf={handleExportPdf} onExportExcel={handleExportExcel}
        />

        <SalesStatsGrid
          summary={summary}
          todayRevenuePct={todayRevenuePct}
          todayTxPct={todayTxPct}
          range={range}
          periodSummary={periodSummary}
          loadingPeriod={loadingPeriod}
          incomeStatement={incomeStatement}
          loadingIncome={loadingIncome}
        />

        <InventoryStatsGrid summary={summary} />

        <div className="grid-2 mb-4">
          <RevenueChart data={chartData} periodLabel={range.label} loading={loadingPeriod} />
          <IncomeStatementSummary incomeStatement={incomeStatement} loading={loadingIncome} periodLabel={range.label} />
        </div>

        <div className="grid-2 mb-4">
          <TopProducts products={periodSummary?.topProducts || []} periodLabel={range.label} />
          <ExpenseRanking expenses={periodSummary?.expensesByCategory || []} periodLabel={range.label} />
        </div>

        <TransactionChart data={chartData} periodLabel={range.label} />

        <div className="card mt-4">
          <div className="flex items-center gap-3">
            <Package size={18} className="text-muted" />
            <div className="text-sm text-muted">
              Total {summary.totalProducts} produk aktif terdaftar di sistem.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
