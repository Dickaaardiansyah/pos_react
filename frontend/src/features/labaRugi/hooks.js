// src/features/labaRugi/hooks.js
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { accountingApi } from "./api";
import { settingsApi } from "../settings/api";
import { queryKeys } from "../../lib/queryClient";

function firstDayOfThisMonth() {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
}
function today() {
  return new Date().toISOString().split("T")[0];
}
function currentYear() {
  return new Date().getFullYear();
}

export const EMPTY_EXPENSE_FORM = {
  expense_date: today(),
  category: "lainnya",
  description: "",
  amount: "",
};

export const REPORT_TYPES = [
  { id: "standard", title: "Laba/Rugi (Standar)", description: "Menampilkan laporan laba rugi untuk periode yg dipilih" },
  { id: "multiYear", title: "Laba/Rugi (Multi Year)", description: "Menampilkan laba rugi per akhir tahun pada rentang periode beberapa tahun terakhir" },
  { id: "quarterly", title: "Laba/Rugi (Kuartal)", description: "Menampilkan laba rugi kuartal pada tahun yang dipilih" },
  { id: "multiPeriod", title: "Laba/Rugi (Multi Periode)", description: "Menampilkan laba rugi bulanan pada rentang periode terpilih" },
  { id: "comparison", title: "Laba/Rugi (Perbandingan Periode)", description: "Menampilkan laba rugi dibandingkan dengan periode lalu, selisihnya ditampilkan dengan persentase" },
];

const VALID_REPORT_TYPES = REPORT_TYPES.map((r) => r.id);

export function useLabaRugi() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = VALID_REPORT_TYPES.includes(searchParams.get("type")) ? searchParams.get("type") : null;

  const [tab, setTab] = useState("statement"); // statement | expenses
  const [reportType, setReportType] = useState(initialType);

  const [startDate, setStartDate] = useState(firstDayOfThisMonth());
  const [endDate, setEndDate] = useState(today());
  const [multiYearEndYear, setMultiYearEndYear] = useState(currentYear());
  const [multiYearSpan, setMultiYearSpan] = useState(3);
  const [quarterlyYear, setQuarterlyYear] = useState(currentYear());
  const [multiPeriodStart, setMultiPeriodStart] = useState(firstDayOfThisMonth());
  const [multiPeriodEnd, setMultiPeriodEnd] = useState(today());
  const [period1Start, setPeriod1Start] = useState(firstDayOfThisMonth());
  const [period1End, setPeriod1End] = useState(today());
  const [period2Start, setPeriod2Start] = useState(firstDayOfThisMonth());
  const [period2End, setPeriod2End] = useState(today());

  const queryClient = useQueryClient();
  const isStatementTab = tab === "statement";

  // ── Data pendukung yang selalu dibutuhkan ───────────────────────────────
  const trendQuery = useQuery({ queryKey: ["accounting", "monthly-trend"], queryFn: () => accountingApi.getMonthlyTrend() });
  const categoriesQuery = useQuery({ queryKey: ["accounting", "expense-categories"], queryFn: () => accountingApi.getExpenseCategories() });
  const storeSettingsQuery = useQuery({ queryKey: queryKeys.settings(), queryFn: () => settingsApi.get() });

  // ── Biaya operasional ────────────────────────────────────────────────
  const expensesQuery = useQuery({
    queryKey: ["accounting", "expenses", { startDate, endDate }],
    queryFn: () => accountingApi.listExpenses({ startDate, endDate }),
    enabled: tab === "expenses",
  });

  // ── Laporan sesuai jenis aktif — satu useQuery per jenis, hanya yang
  //    cocok dengan reportType saat ini yang enabled. ─────────────────────
  const standardQuery = useQuery({
    queryKey: ["accounting", "income-statement", { startDate, endDate }],
    queryFn: () => accountingApi.getIncomeStatement({ start_date: startDate, end_date: endDate }),
    enabled: isStatementTab && reportType === "standard",
  });
  const multiYearQuery = useQuery({
    queryKey: ["accounting", "income-statement", "multi-year", { multiYearSpan, multiYearEndYear }],
    queryFn: () => accountingApi.getMultiYearIncomeStatement({ years: multiYearSpan, end_year: multiYearEndYear }),
    enabled: isStatementTab && reportType === "multiYear",
  });
  const quarterlyQuery = useQuery({
    queryKey: ["accounting", "income-statement", "quarterly", quarterlyYear],
    queryFn: () => accountingApi.getQuarterlyIncomeStatement({ year: quarterlyYear }),
    enabled: isStatementTab && reportType === "quarterly",
  });
  const multiPeriodQuery = useQuery({
    queryKey: ["accounting", "income-statement", "multi-period", { multiPeriodStart, multiPeriodEnd }],
    queryFn: () => accountingApi.getMultiPeriodIncomeStatement({ start_date: multiPeriodStart, end_date: multiPeriodEnd }),
    enabled: isStatementTab && reportType === "multiPeriod",
  });
  const comparisonQuery = useQuery({
    queryKey: ["accounting", "income-statement", "comparison", { period1Start, period1End, period2Start, period2End }],
    queryFn: () =>
      accountingApi.getComparisonIncomeStatement({
        period1_start: period1Start,
        period1_end: period1End,
        period2_start: period2Start,
        period2_end: period2End,
      }),
    enabled: isStatementTab && reportType === "comparison",
  });

  const reportQueryByType = {
    standard: standardQuery,
    multiYear: multiYearQuery,
    quarterly: quarterlyQuery,
    multiPeriod: multiPeriodQuery,
    comparison: comparisonQuery,
  };
  const activeReportQuery = reportType ? reportQueryByType[reportType] : null;

  function selectReportType(id) {
    setReportType(id);
    setSearchParams({ type: id });
  }
  function backToPicker() {
    setReportType(null);
    setSearchParams({});
  }

  function invalidateExpensesAndReport() {
    queryClient.invalidateQueries({ queryKey: ["accounting", "expenses"] });
    queryClient.invalidateQueries({ queryKey: ["accounting", "income-statement"] });
  }

  const createExpenseMutation = useMutation({
    mutationFn: (payload) => accountingApi.createExpense(payload),
    onSuccess: () => {
      toast.success("Biaya operasional dicatat");
      invalidateExpensesAndReport();
    },
  });
  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, payload }) => accountingApi.updateExpense(id, payload),
    onSuccess: () => {
      toast.success("Biaya operasional diperbarui");
      invalidateExpensesAndReport();
    },
  });
  const removeExpenseMutation = useMutation({
    mutationFn: (expense) => accountingApi.removeExpense(expense.id),
    onSuccess: () => {
      toast.success("Biaya operasional dihapus");
      invalidateExpensesAndReport();
    },
  });

  async function createExpense(payload) {
    try {
      await createExpenseMutation.mutateAsync(payload);
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  }
  async function updateExpense(id, payload) {
    try {
      await updateExpenseMutation.mutateAsync({ id, payload });
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  }
  function removeExpense(expense) {
    if (!confirm(`Hapus catatan biaya "${expense.description || expense.category}"?`)) return;
    removeExpenseMutation.mutate(expense);
  }

  const trend = trendQuery.data?.data ?? [];
  const trendChartData = trend.map((t) => ({ month: t.month, Pendapatan: t.revenue, HPP: t.cogs, "Laba Kotor": t.gross_profit }));

  return {
    tab,
    setTab,
    reportType,
    selectReportType,
    backToPicker,
    reportTypes: REPORT_TYPES,

    startDate,
    setStartDate,
    endDate,
    setEndDate,
    multiYearEndYear,
    setMultiYearEndYear,
    multiYearSpan,
    setMultiYearSpan,
    quarterlyYear,
    setQuarterlyYear,
    multiPeriodStart,
    setMultiPeriodStart,
    multiPeriodEnd,
    setMultiPeriodEnd,
    period1Start,
    setPeriod1Start,
    period1End,
    setPeriod1End,
    period2Start,
    setPeriod2Start,
    period2End,
    setPeriod2End,

    statement: standardQuery.data?.data ?? null,
    multiYearReport: multiYearQuery.data?.data ?? null,
    quarterlyReport: quarterlyQuery.data?.data ?? null,
    multiPeriodReport: multiPeriodQuery.data?.data ?? null,
    comparisonReport: comparisonQuery.data?.data ?? null,

    trend,
    trendChartData,
    expenses: expensesQuery.data?.data ?? [],
    categories: categoriesQuery.data?.data ?? [],
    storeSettings: storeSettingsQuery.data?.data ?? {},
    loading: tab === "expenses" ? expensesQuery.isLoading : activeReportQuery?.isLoading ?? false,
    createExpense,
    updateExpense,
    removeExpense,
    reload: () => activeReportQuery?.refetch(),
  };
}
