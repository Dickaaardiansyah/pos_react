// src/features/dashboard/hooks.js
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { transactionsApi } from "../transactions/api";
import { accountingApi } from "../labaRugi/api";
import { settingsApi } from "../settings/api";
import { formatShortDate } from "../../utils/format";
import { queryKeys } from "../../lib/queryClient";

function pad(n) {
  return String(n).padStart(2, "0");
}
function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function today() {
  return toISODate(new Date());
}
function firstDayOfThisMonth() {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

// Filter tanggal fleksibel untuk dashboard: preset cepat, tahun tertentu
// (termasuk tahun lalu), dan rentang tanggal custom bebas.
export const DASHBOARD_FILTER_OPTIONS = [
  { value: "today", label: "Hari Ini" },
  { value: "7days", label: "7 Hari" },
  { value: "30days", label: "30 Hari" },
  { value: "thisMonth", label: "Bulan Ini" },
  { value: "year", label: "Tahun" },
  { value: "custom", label: "Custom" },
];

function currentYear() {
  return new Date().getFullYear();
}

// Tahun yang bisa dipilih di dropdown "Tahun" — tahun berjalan + 4 tahun ke belakang.
export function availableYears() {
  const y = currentYear();
  return [y, y - 1, y - 2, y - 3, y - 4];
}

function rangeForFilter(filterMode, { year, customStart, customEnd }) {
  const t = today();
  switch (filterMode) {
    case "today":
      return { start: t, end: t, label: "Hari Ini" };
    case "7days":
      return { start: toISODate(new Date(Date.now() - 6 * 86400000)), end: t, label: "7 Hari Terakhir" };
    case "30days":
      return { start: toISODate(new Date(Date.now() - 29 * 86400000)), end: t, label: "30 Hari Terakhir" };
    case "year": {
      const y = year || currentYear();
      const isCurrentYear = y === currentYear();
      return { start: `${y}-01-01`, end: isCurrentYear ? t : `${y}-12-31`, label: `Tahun ${y}` };
    }
    case "custom":
      return { start: customStart || firstDayOfThisMonth(), end: customEnd || t, label: "Rentang Custom" };
    case "thisMonth":
    default:
      return { start: firstDayOfThisMonth(), end: t, label: "Bulan Ini" };
  }
}

export function useDashboard() {
  const [filterMode, setFilterMode] = useState("thisMonth");
  const [selectedYear, setSelectedYear] = useState(currentYear());
  const [customStart, setCustomStart] = useState(firstDayOfThisMonth());
  const [customEnd, setCustomEnd] = useState(today());

  const range = useMemo(
    () => rangeForFilter(filterMode, { year: selectedYear, customStart, customEnd }),
    [filterMode, selectedYear, customStart, customEnd],
  );

  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboardSummary(),
    queryFn: () => transactionsApi.getDashboardSummary(),
  });
  const periodQuery = useQuery({
    queryKey: queryKeys.dashboardPeriod(range),
    queryFn: () => transactionsApi.getDashboardPeriodSummary({ start_date: range.start, end_date: range.end }),
  });
  const incomeQuery = useQuery({
    queryKey: queryKeys.incomeStatement(range),
    queryFn: () => accountingApi.getIncomeStatement({ start_date: range.start, end_date: range.end }),
    // Ringkasan laba rugi bersifat pelengkap — gagal diam-diam, jangan
    // ganggu dashboard utama.
    throwOnError: false,
  });
  const storeSettingsQuery = useQuery({ queryKey: queryKeys.settings(), queryFn: () => settingsApi.get() });

  const summary = summaryQuery.data?.data ?? null;
  const periodSummary = periodQuery.data?.data ?? null;

  function refresh() {
    summaryQuery.refetch();
    periodQuery.refetch();
    incomeQuery.refetch();
  }

  const todayRevenuePct =
    summary?.yesterday?.revenue > 0
      ? (((summary.today.revenue - summary.yesterday.revenue) / summary.yesterday.revenue) * 100).toFixed(1)
      : null;
  const todayTxPct =
    summary?.yesterday?.tx_count > 0
      ? (((summary.today.tx_count - summary.yesterday.tx_count) / summary.yesterday.tx_count) * 100).toFixed(1)
      : null;

  const chartSource = periodSummary?.revenueHistory || [];
  const chartData = chartSource.map((d) => ({
    date: formatShortDate(d.date),
    revenue: Math.round(d.revenue),
    tx: d.tx_count,
  }));

  return {
    summary,
    loading: summaryQuery.isLoading,

    filterMode,
    setFilterMode,
    selectedYear,
    setSelectedYear,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    range,

    periodSummary,
    loadingPeriod: periodQuery.isLoading,
    chartData,
    todayRevenuePct,
    todayTxPct,
    incomeStatement: incomeQuery.data?.data ?? null,
    loadingIncome: incomeQuery.isLoading,
    storeSettings: storeSettingsQuery.data?.data ?? {},
    refresh,
  };
}
