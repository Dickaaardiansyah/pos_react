// src/features/dashboard/components/SalesStatsGrid.jsx
import { useNavigate } from "react-router-dom";
import { DollarSign, ShoppingCart, TrendingUp, MinusCircle, CalendarRange } from "lucide-react";
import { StatCard } from "../../../components/UI";
import { formatRupiah } from "../../../utils/format";
import { today, formatChangeText } from "../utils/dashboardHelper";
import StatsSectionLabel from "./StatsSectionLabel";

export default function SalesStatsGrid({
  summary, todayRevenuePct, todayTxPct, range, periodSummary, loadingPeriod, incomeStatement, loadingIncome,
}) {
  const navigate = useNavigate();

  function goToTransactions(startDate, endDate) {
    navigate(`/transaksi?start_date=${startDate}&end_date=${endDate}`);
  }

  return (
    <>
      <StatsSectionLabel icon={TrendingUp} title="Penjualan & Laba" />
      <div className="stats-grid">
        <StatCard
          icon={DollarSign} tone="blue" label="Pendapatan Hari Ini"
          value={formatRupiah(summary.today.revenue)}
          change={formatChangeText(todayRevenuePct !== null ? Number(todayRevenuePct) : null)}
          changeTone={todayRevenuePct >= 0 ? "positive" : "negative"}
          onClick={() => goToTransactions(today(), today())}
        />
        <StatCard
          icon={ShoppingCart} tone="green" label="Transaksi Hari Ini"
          value={summary.today.tx_count}
          change={formatChangeText(todayTxPct !== null ? Number(todayTxPct) : null)}
          changeTone={todayTxPct >= 0 ? "positive" : "negative"}
          onClick={() => goToTransactions(today(), today())}
        />
        <StatCard
          icon={CalendarRange} tone="cyan" label="Pendapatan Minggu Ini"
          value={formatRupiah(summary.thisWeek.revenue)}
          change={`${summary.thisWeek.tx_count} transaksi`} changeTone="neutral"
        />
        <StatCard
          icon={TrendingUp} tone="purple" label={`Pendapatan (${range.label})`}
          value={loadingPeriod || !periodSummary ? "..." : formatRupiah(periodSummary.revenue)}
          change={loadingPeriod || !periodSummary ? undefined : `${periodSummary.txCount} transaksi — klik untuk lihat rincian`}
          changeTone="neutral"
          onClick={() => goToTransactions(range.start, range.end)}
        />
        <StatCard
          icon={TrendingUp} tone={!loadingIncome && incomeStatement && incomeStatement.gross_profit < 0 ? "red" : "green"}
          label={`Laba Kotor (${range.label})`}
          value={loadingIncome || !incomeStatement ? "..." : formatRupiah(incomeStatement.gross_profit)}
          valueTone={!loadingIncome && incomeStatement ? (incomeStatement.gross_profit < 0 ? "negative" : "positive") : undefined}
        />
        <StatCard
          icon={MinusCircle} tone="red" label={`Total Pengeluaran (${range.label})`}
          value={loadingPeriod || !periodSummary ? "..." : formatRupiah(periodSummary.expensesTotal)}
        />
      </div>
    </>
  );
}
