// src/features/reports/hooks.js
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { transactionsApi } from "../transactions/api";
import { purchaseApi } from "../purchase/api";
import { settingsApi } from "../settings/api";
import { queryKeys } from "../../lib/queryClient";

function defaultStart() {
  return new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
}
function defaultEnd() {
  return new Date().toISOString().split("T")[0];
}

export const REPORT_TYPES = [
  { id: "penjualan", title: "Laporan Penjualan", description: "Analisis performa penjualan produk & pendapatan" },
  { id: "penjualanPelanggan", title: "Laporan Penjualan per Pelanggan", description: "Rekap pendapatan, HPP, & laba per pelanggan dalam suatu periode" },
  { id: "labaProduk", title: "Laporan Laba per Produk", description: "Keuntungan tiap barang: pendapatan dikurangi harga beli dari supplier" },
  { id: "barangMasuk", title: "Laporan Barang Masuk", description: "Rekap pembelian stok dari supplier per periode" },
  { id: "barangExpired", title: "Laporan Barang Expired", description: "Batch barang masuk yang sudah/akan lewat tanggal kadaluarsa" },
];

const VALID_TYPES = REPORT_TYPES.map((r) => r.id);

export const QUICK_RANGE_OPTIONS = [
  { value: "today", label: "Hari Ini", days: 0 },
  { value: "2days", label: "2 Hari Terakhir", days: 1 },
  { value: "7days", label: "7 Hari Terakhir", days: 6 },
  { value: "30days", label: "30 Hari Terakhir", days: 29 },
  { value: "custom", label: "Custom", days: null },
];

export const PROFIT_SORT_OPTIONS = [
  { value: "profit", label: "Laba Terbesar" },
  { value: "revenue", label: "Pendapatan Terbesar" },
  { value: "qty", label: "Qty Terbanyak" },
  { value: "margin", label: "Margin Terbesar" },
  { value: "name", label: "Nama Produk (A-Z)" },
];

function isoToday() {
  return new Date().toISOString().split("T")[0];
}
function rangeFromQuickOption(days) {
  const end = isoToday();
  const start = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  return { start, end };
}

export const SALES_SORT_OPTIONS = [
  { value: "revenue", label: "Pendapatan Terbesar" },
  { value: "qty", label: "Qty Terbanyak" },
  { value: "name", label: "Nama Produk (A-Z)" },
];

export const CUSTOMER_SORT_OPTIONS = [
  { value: "revenue", label: "Pendapatan Terbesar" },
  { value: "profit", label: "Laba Terbesar" },
  { value: "transactions", label: "Transaksi Terbanyak" },
  { value: "name", label: "Nama Pelanggan (A-Z)" },
];

export const PURCHASE_SORT_OPTIONS = [
  { value: "cost", label: "Biaya Terbesar" },
  { value: "qty", label: "Qty Terbanyak" },
  { value: "name", label: "Nama Produk (A-Z)" },
];

export function useReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = VALID_TYPES.includes(searchParams.get("type")) ? searchParams.get("type") : null;
  const [reportType, setReportType] = useState(initialType);

  const [period, setPeriod] = useState("daily");
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [expiredStatus, setExpiredStatus] = useState("");
  const [thresholdDays, setThresholdDays] = useState(30);
  const [salesSort, setSalesSort] = useState("revenue");
  const [purchaseSort, setPurchaseSort] = useState("cost");
  const [customerSort, setCustomerSort] = useState("revenue");

  const [quickRange, setQuickRange] = useState("today");
  const [profitStartDate, setProfitStartDate] = useState(isoToday());
  const [profitEndDate, setProfitEndDate] = useState(isoToday());
  const [profitSort, setProfitSort] = useState("profit");

  function selectQuickRange(value) {
    setQuickRange(value);
    const opt = QUICK_RANGE_OPTIONS.find((o) => o.value === value);
    if (opt && opt.days !== null) {
      const { start, end } = rangeFromQuickOption(opt.days);
      setProfitStartDate(start);
      setProfitEndDate(end);
    }
  }
  function setProfitStartDateCustom(v) {
    setQuickRange("custom");
    setProfitStartDate(v);
  }
  function setProfitEndDateCustom(v) {
    setQuickRange("custom");
    setProfitEndDate(v);
  }

  const storeSettingsQuery = useQuery({ queryKey: queryKeys.settings(), queryFn: () => settingsApi.get() });

  const salesQuery = useQuery({
    queryKey: queryKeys.reports("penjualan", { period, startDate, endDate }),
    queryFn: () => transactionsApi.getSalesReport({ period, start_date: startDate, end_date: endDate }),
    enabled: reportType === "penjualan",
  });
  const customerQuery = useQuery({
    queryKey: queryKeys.reports("penjualanPelanggan", { startDate, endDate }),
    queryFn: () => transactionsApi.getSalesByCustomerReport({ start_date: startDate, end_date: endDate }),
    enabled: reportType === "penjualanPelanggan",
  });
  const purchaseQuery = useQuery({
    queryKey: queryKeys.reports("barangMasuk", { period, startDate, endDate }),
    queryFn: () => purchaseApi.getReport({ period, start_date: startDate, end_date: endDate }),
    enabled: reportType === "barangMasuk",
  });
  const expiredQuery = useQuery({
    queryKey: queryKeys.reports("barangExpired", { startDate, endDate, expiredStatus, thresholdDays }),
    queryFn: () =>
      purchaseApi.getExpiredReport({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        status: expiredStatus || undefined,
        threshold_days: thresholdDays,
      }),
    enabled: reportType === "barangExpired",
  });
  const profitQuery = useQuery({
    queryKey: queryKeys.reports("labaProduk", { profitStartDate, profitEndDate }),
    queryFn: () => transactionsApi.getProductProfitReport({ start_date: profitStartDate, end_date: profitEndDate }),
    enabled: reportType === "labaProduk",
  });

  const queryByType = {
    penjualan: salesQuery,
    penjualanPelanggan: customerQuery,
    barangMasuk: purchaseQuery,
    barangExpired: expiredQuery,
    labaProduk: profitQuery,
  };
  const activeQuery = reportType ? queryByType[reportType] : null;

  function selectReportType(id) {
    setReportType(id);
    setSearchParams({ type: id });
  }
  function backToPicker() {
    setReportType(null);
    setSearchParams({});
  }

  const salesReport = salesQuery.data?.data ?? null;
  const purchaseReport = purchaseQuery.data?.data ?? null;
  const expiredReport = expiredQuery.data?.data ?? null;
  const profitReport = profitQuery.data?.data ?? null;
  const customerReport = customerQuery.data?.data ?? null;

  const salesChartData = (salesReport?.salesData || []).map((d) => ({
    period: d.period,
    revenue: Math.round(d.revenue),
    transactions: d.transaction_count,
  }));
  const purchaseChartData = (purchaseReport?.periodData || []).map((d) => ({
    period: d.period,
    cost: Math.round(d.total_cost),
    qty: d.total_qty,
  }));

  const sortedSalesTopProducts = useMemo(() => {
    const arr = [...(salesReport?.topProducts || [])];
    if (salesSort === "qty") arr.sort((a, b) => b.total_qty_base - a.total_qty_base);
    else if (salesSort === "name") arr.sort((a, b) => a.name.localeCompare(b.name, "id"));
    else arr.sort((a, b) => b.total_revenue - a.total_revenue);
    return arr;
  }, [salesReport, salesSort]);

  const sortedPurchaseTopProducts = useMemo(() => {
    const arr = [...(purchaseReport?.topProducts || [])];
    if (purchaseSort === "qty") arr.sort((a, b) => b.total_qty - a.total_qty);
    else if (purchaseSort === "name") arr.sort((a, b) => a.product_name.localeCompare(b.product_name, "id"));
    else arr.sort((a, b) => b.total_cost - a.total_cost);
    return arr;
  }, [purchaseReport, purchaseSort]);

  const sortedProfitProducts = useMemo(() => {
    const arr = [...(profitReport?.items || [])];
    if (profitSort === "revenue") arr.sort((a, b) => b.total_revenue - a.total_revenue);
    else if (profitSort === "qty") arr.sort((a, b) => b.total_qty_base - a.total_qty_base);
    else if (profitSort === "margin") arr.sort((a, b) => b.margin_percent - a.margin_percent);
    else if (profitSort === "name") arr.sort((a, b) => a.name.localeCompare(b.name, "id"));
    else arr.sort((a, b) => b.total_profit - a.total_profit);
    return arr;
  }, [profitReport, profitSort]);

  const sortedCustomers = useMemo(() => {
    const arr = [...(customerReport?.items || [])];
    if (customerSort === "profit") arr.sort((a, b) => b.total_profit - a.total_profit);
    else if (customerSort === "transactions") arr.sort((a, b) => b.transaction_count - a.transaction_count);
    else if (customerSort === "name") arr.sort((a, b) => a.customer_name.localeCompare(b.customer_name, "id"));
    else arr.sort((a, b) => b.total_revenue - a.total_revenue);
    return arr;
  }, [customerReport, customerSort]);

  return {
    reportTypes: REPORT_TYPES,
    reportType,
    selectReportType,
    backToPicker,

    period,
    setPeriod,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    expiredStatus,
    setExpiredStatus,
    thresholdDays,
    setThresholdDays,
    salesSort,
    setSalesSort,
    purchaseSort,
    setPurchaseSort,
    customerSort,
    setCustomerSort,

    quickRange,
    selectQuickRange,
    profitStartDate,
    setProfitStartDate: setProfitStartDateCustom,
    profitEndDate,
    setProfitEndDate: setProfitEndDateCustom,
    profitSort,
    setProfitSort,

    salesReport,
    purchaseReport,
    expiredReport,
    profitReport,
    customerReport,
    salesChartData,
    purchaseChartData,
    sortedSalesTopProducts,
    sortedPurchaseTopProducts,
    sortedProfitProducts,
    sortedCustomers,
    storeSettings: storeSettingsQuery.data?.data ?? {},
    loading: activeQuery?.isLoading ?? false,
    reload: () => activeQuery?.refetch(),
  };
}
