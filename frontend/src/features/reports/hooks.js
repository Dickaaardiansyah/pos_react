// src/features/reports/hooks.js
// ─────────────────────────────────────────────────────────────────────────────
// HOOKS LAYER — state, filter, dan data fetching untuk seluruh jenis laporan.
// Laporan dipisah per modul (penjualan / kas / produk / pembelian / piutang).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { transactionsApi } from "../transactions/api";
import { purchaseApi } from "../purchase/api";
import { cashRegisterApi } from "../cashRegister/api";
import { settingsApi } from "../settings/api";
import { journalApi } from "../journal/api";
import { stockMutationApi } from "../stockMutation/api";
import { stockOpnameApi } from "../stockOpname/api";
import { payablesApi } from "../payables/api";
import { receivablesApi } from "../receivables/api";
import { customersApi } from "../customers/api";
import { queryKeys } from "../../lib/queryClient";

function defaultStart() {
  return new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
}
function defaultEnd() {
  return new Date().toISOString().split("T")[0];
}
function isoToday() {
  return new Date().toISOString().split("T")[0];
}
function rangeFromQuickOption(days) {
  const end = isoToday();
  const start = new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];
  return { start, end };
}

export const REPORT_TYPES = [
  // ── Penjualan ────────────────────────────────────────────────────────────
  {
    id: "penjualanHarian",
    title: "Laporan Penjualan Harian",
    description: "Rincian seluruh transaksi pada satu tanggal tertentu",
    group: "penjualan",
  },
  {
    id: "penjualanPeriode",
    title: "Laporan Penjualan Periode",
    description: "Ringkasan penjualan per hari / minggu / bulan + grafik",
    group: "penjualan",
  },
  {
    id: "penjualan",
    title: "Laporan Penjualan (Produk & Kategori)",
    description: "Analisis performa penjualan produk & pendapatan",
    group: "penjualan",
  },
  {
    id: "penjualanPelanggan",
    title: "Laporan Penjualan per Pelanggan",
    description:
      "Rekap pendapatan, HPP, & laba per pelanggan dalam suatu periode",
    group: "penjualan",
  },
  {
    id: "labaProduk",
    title: "Laporan Laba per Produk",
    description:
      "Keuntungan tiap barang: pendapatan dikurangi harga beli dari supplier",
    group: "penjualan",
  },
  // ── Kas ──────────────────────────────────────────────────────────────────
  {
    id: "kasMasukKeluar",
    title: "Laporan Kas Masuk & Keluar",
    description: "Rekap kas masuk & keluar lintas shift dalam suatu periode",
    group: "kas",
  },
  {
    id: "cashFlow",
    title: "Laporan Cash Flow (Arus Kas)",
    description: "Saldo awal + kas masuk − kas keluar = saldo akhir",
    group: "kas",
  },
  {
    id: "shiftKasir",
    title: "Laporan Shift Kasir",
    description: "Rekap tutup kas per shift: seharusnya vs aktual & selisih",
    group: "kas",
  },
  // ── Produk ───────────────────────────────────────────────────────────────
  {
    id: "barangMasuk",
    title: "Laporan Barang Masuk",
    description: "Rekap pembelian stok dari supplier per periode",
    group: "produk",
  },
  {
    id: "barangKeluar",
    title: "Laporan Barang Keluar",
    description:
      "Mutasi stok keluar: penjualan, rusak, opname, penyesuaian, dll",
    group: "produk",
  },
  {
    id: "stockOpname",
    title: "Laporan Stock Opname",
    description: "Sistem vs fisik vs selisih per sesi opname",
    group: "produk",
  },
  {
    id: "barangExpired",
    title: "Laporan Barang Expired",
    description: "Batch barang masuk yang sudah/akan lewat tanggal kadaluarsa",
    group: "produk",
  },
  // ── Pembelian ────────────────────────────────────────────────────────────
  {
    id: "pembelian",
    title: "Laporan Pembelian",
    description: "Daftar & ringkasan pembelian per periode",
    group: "pembelian",
  },
  {
    id: "pembelianSupplier",
    title: "Laporan Pembelian per Supplier",
    description: "Total pembelian, transaksi, & sisa hutang per supplier",
    group: "pembelian",
  },
  {
    id: "hutangSupplier",
    title: "Laporan Hutang Supplier",
    description: "Daftar hutang: total, jatuh tempo, status lunas/belum",
    group: "pembelian",
  },
  {
    id: "piutangFakturBelumLunas",
    title: "Laporan Faktur Belum Lunas",
    description: "Daftar seluruh faktur/piutang pelanggan yang belum dilunasi",
    group: "piutang",
  },
  {
    id: "piutangPerPelanggan",
    title: "Laporan Piutang per Pelanggan",
    description:
      "Total faktur, tagihan, & sisa piutang dikelompokkan per pelanggan",
    group: "piutang",
  },
  {
    id: "piutangAging",
    title: "Laporan Umur Piutang (Aging)",
    description:
      "Klasifikasi piutang: belum jatuh tempo, 1–30, 31–60, 61–90, 90+ hari",
    group: "piutang",
  },
  {
    id: "piutangRiwayat",
    title: "Laporan Riwayat Pembayaran Piutang",
    description: "Histori pembayaran piutang per periode & pelanggan",
    group: "piutang",
  },
  {
    id: "metodePembayaran",
    title: "Laporan Metode Pembayaran",
    description:
      "Rekap omzet & jumlah transaksi per metode: tunai, QRIS, debit, dll",
    group: "penjualan",
  },
  {
    id: "transaksiVoid",
    title: "Laporan Transaksi Void",
    description:
      "Daftar transaksi yang dibatalkan: kasir, alasan, nilai, waktu",
    group: "penjualan",
  },
];

const VALID_TYPES = REPORT_TYPES.map((r) => r.id);

export const QUICK_RANGE_OPTIONS = [
  { value: "today", label: "Hari Ini", days: 0 },
  { value: "2days", label: "2 Hari Terakhir", days: 1 },
  { value: "7days", label: "7 Hari Terakhir", days: 6 },
  { value: "30days", label: "30 Hari Terakhir", days: 29 },
  { value: "custom", label: "Custom", days: null },
];

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

export const PROFIT_SORT_OPTIONS = [
  { value: "profit", label: "Laba Terbesar" },
  { value: "revenue", label: "Pendapatan Terbesar" },
  { value: "qty", label: "Qty Terbanyak" },
  { value: "margin", label: "Margin Terbesar" },
  { value: "name", label: "Nama Produk (A-Z)" },
];

export const PERIOD_OPTIONS = [
  { value: "daily", label: "Harian" },
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
];

export function useReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = VALID_TYPES.includes(searchParams.get("type"))
    ? searchParams.get("type")
    : null;
  const [reportType, setReportType] = useState(initialType);

  const [dailyDate, setDailyDate] = useState(isoToday());
  const [period, setPeriod] = useState("daily");
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [expiredStatus, setExpiredStatus] = useState("");
  const [thresholdDays, setThresholdDays] = useState(30);
  const [salesSort, setSalesSort] = useState("revenue");
  const [purchaseSort, setPurchaseSort] = useState("cost");
  const [customerSort, setCustomerSort] = useState("revenue");
  const [stockOutJenis, setStockOutJenis] = useState("");
  const [piutangCustomerId, setPiutangCustomerId] = useState("");
  const [cashierFilter, setCashierFilter] = useState("");
  const [opnameDetailId, setOpnameDetailId] = useState(null);

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

  function selectReportType(id) {
    setReportType(id);
    setSearchParams(id ? { type: id } : {});
    setOpnameDetailId(null);
  }
  function backToPicker() {
    setReportType(null);
    setSearchParams({});
    setOpnameDetailId(null);
  }

  const storeSettingsQuery = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => settingsApi.get(),
  });

  // ── Queries ──────────────────────────────────────────────────────────────
  const dailyQuery = useQuery({
    queryKey: queryKeys.reports("penjualanHarian", { dailyDate }),
    queryFn: () => transactionsApi.getDailySalesReport({ date: dailyDate }),
    enabled: reportType === "penjualanHarian",
  });

  const kasQuery = useQuery({
    queryKey: queryKeys.reports("kasMasukKeluar", { startDate, endDate }),
    queryFn: () =>
      cashRegisterApi.getReport({ start_date: startDate, end_date: endDate }),
    enabled: reportType === "kasMasukKeluar",
  });

  const salesQuery = useQuery({
    queryKey: queryKeys.reports("penjualan", { period, startDate, endDate }),
    queryFn: () =>
      transactionsApi.getSalesReport({
        period,
        start_date: startDate,
        end_date: endDate,
      }),
    enabled: reportType === "penjualan" || reportType === "penjualanPeriode",
  });

  const customerQuery = useQuery({
    queryKey: queryKeys.reports("penjualanPelanggan", { startDate, endDate }),
    queryFn: () =>
      transactionsApi.getSalesByCustomerReport({
        start_date: startDate,
        end_date: endDate,
      }),
    enabled: reportType === "penjualanPelanggan",
  });

  const purchaseQuery = useQuery({
    queryKey: queryKeys.reports("barangMasuk", { period, startDate, endDate }),
    queryFn: () =>
      purchaseApi.getReport({
        period,
        start_date: startDate,
        end_date: endDate,
      }),
    enabled:
      reportType === "barangMasuk" ||
      reportType === "pembelian" ||
      reportType === "pembelianSupplier",
  });

  const purchaseListQuery = useQuery({
    queryKey: queryKeys.reports("pembelianList", { startDate, endDate }),
    queryFn: () =>
      purchaseApi.list({
        start_date: startDate,
        end_date: endDate,
        limit: 200,
      }),
    enabled: reportType === "pembelian",
  });

  const expiredQuery = useQuery({
    queryKey: queryKeys.reports("barangExpired", {
      startDate,
      endDate,
      expiredStatus,
      thresholdDays,
    }),
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
    queryKey: queryKeys.reports("labaProduk", {
      profitStartDate,
      profitEndDate,
    }),
    queryFn: () =>
      transactionsApi.getProductProfitReport({
        start_date: profitStartDate,
        end_date: profitEndDate,
      }),
    enabled: reportType === "labaProduk",
  });

  const cashFlowQuery = useQuery({
    queryKey: queryKeys.reports("cashFlow", { startDate, endDate }),
    queryFn: () =>
      journalApi.getCashFlow({ start_date: startDate, end_date: endDate }),
    enabled: reportType === "cashFlow",
  });

  const shiftQuery = useQuery({
    queryKey: queryKeys.reports("shiftKasir", { startDate, endDate }),
    queryFn: async () => {
      const res = await cashRegisterApi.history({
        start_date: startDate,
        end_date: endDate,
        limit: 200,
        page: 1,
      });
      const rows = res?.data || res?.rows || [];
      const summary = {
        total_shifts: rows.length,
        total_opening: rows.reduce(
          (s, x) => s + Number(x.opening_balance || 0),
          0,
        ),
        total_cash_sales: rows.reduce(
          (s, x) => s + Number(x.total_cash_sales || 0),
          0,
        ),
        total_cash_in: rows.reduce(
          (s, x) => s + Number(x.total_cash_in || 0),
          0,
        ),
        total_cash_out: rows.reduce(
          (s, x) => s + Number(x.total_cash_out || 0),
          0,
        ),
        total_difference: rows.reduce(
          (s, x) => s + Number(x.difference || 0),
          0,
        ),
      };
      return { data: rows, summary };
    },
    enabled: reportType === "shiftKasir",
  });

  const stockOutQuery = useQuery({
    queryKey: queryKeys.reports("barangKeluar", {
      startDate,
      endDate,
      stockOutJenis,
    }),
    queryFn: async () => {
      const [listRes, summaryRes] = await Promise.all([
        stockMutationApi.list({
          start_date: startDate,
          end_date: endDate,
          type: "out",
          jenis: stockOutJenis || undefined,
          limit: 300,
          page: 1,
        }),
        stockMutationApi.getSummary({
          start_date: startDate,
          end_date: endDate,
        }),
      ]);
      const data = listRes?.data || [];
      const byType = (summaryRes?.byType || summaryRes?.data?.byType || []).map(
        (t) => ({
          ...t,
          label: t.label || t.jenis,
        }),
      );
      const totalQtyOut = byType.reduce(
        (s, t) => s + Number(t.total_qty_keluar || 0),
        0,
      );
      return {
        data,
        byType,
        summary: { total_rows: data.length, total_qty_out: totalQtyOut },
      };
    },
    enabled: reportType === "barangKeluar",
  });

  const opnameListQuery = useQuery({
    queryKey: queryKeys.reports("stockOpname", { startDate, endDate }),
    queryFn: async () => {
      const res = await stockOpnameApi.list({
        start_date: startDate,
        end_date: endDate,
        limit: 100,
        page: 1,
      });
      const sessions = res?.data || [];
      return {
        sessions,
        summary: {
          total_sessions: sessions.length,
          total_items: sessions.reduce(
            (s, x) => s + Number(x.item_count || x.items_count || 0),
            0,
          ),
          total_minus: 0,
          total_plus: 0,
        },
        selectedDetail: null,
      };
    },
    enabled: reportType === "stockOpname",
  });

  const opnameDetailQuery = useQuery({
    queryKey: queryKeys.reports("stockOpnameDetail", { opnameDetailId }),
    queryFn: () => stockOpnameApi.getById(opnameDetailId),
    enabled: reportType === "stockOpname" && !!opnameDetailId,
  });

  const payableQuery = useQuery({
    queryKey: queryKeys.reports("hutangSupplier", { startDate, endDate }),
    queryFn: async () => {
      const [listRes, unpaidSupplierRes, summaryRes] = await Promise.all([
        payablesApi.getAll({ limit: 200 }),
        payablesApi.getUnpaidPerSupplier?.() || Promise.resolve({ data: [] }),
        payablesApi.getSummary?.() || Promise.resolve({ data: {} }),
      ]);
      const rawList = listRes?.data ?? listRes ?? [];
      // payableModel.findAll() balikin array biasa kalau tanpa limit,
      // tapi { total, rows } kalau pakai limit (mode paginasi) — di sini
      // kita selalu minta limit:200, jadi normalisasi ke array flat.
      const data = Array.isArray(rawList) ? rawList : rawList.rows || [];
      const bySupplier = unpaidSupplierRes?.data || unpaidSupplierRes || [];
      const summary = summaryRes?.data || summaryRes || {};
      return { data, bySupplier, summary };
    },
    enabled: reportType === "hutangSupplier",
  });

  const customersListQuery = useQuery({
    queryKey: queryKeys.customers({}),
    queryFn: () => customersApi.getAll({}),
    staleTime: 60_000,
  });
  const cashiersQuery = useQuery({
    queryKey: ["cashiers"],
    queryFn: () => transactionsApi.listCashiers(),
    staleTime: 60_000,
  });
  const piutangUnpaidQuery = useQuery({
    queryKey: queryKeys.reports("piutangFakturBelumLunas", {
      piutangCustomerId,
    }),
    queryFn: async () => {
      const params = piutangCustomerId
        ? { customer_id: piutangCustomerId }
        : undefined;
      const [listRes, summaryRes] = await Promise.all([
        receivablesApi.getUnpaid(params),
        receivablesApi.getSummary(),
      ]);
      const raw = listRes?.data ?? listRes ?? [];
      const data = Array.isArray(raw) ? raw : raw.rows || [];
      const filtered = data.filter(
        (x) => x.status !== "lunas" && x.status !== "dibatalkan",
      );
      const summary = summaryRes?.data || summaryRes || {};
      return { data: filtered, summary };
    },
    enabled: reportType === "piutangFakturBelumLunas",
  });
  const piutangPerCustomerQuery = useQuery({
    queryKey: queryKeys.reports("piutangPerPelanggan"),
    queryFn: async () => {
      const [listRes, summaryRes] = await Promise.all([
        receivablesApi.getUnpaidPerCustomer(),
        receivablesApi.getSummary(),
      ]);
      const data = listRes?.data ?? listRes ?? [];
      const summary = summaryRes?.data || summaryRes || {};
      return { data: Array.isArray(data) ? data : [], summary };
    },
    enabled: reportType === "piutangPerPelanggan",
  });
  const piutangAgingQuery = useQuery({
    queryKey: queryKeys.reports("piutangAging"),
    queryFn: async () => {
      const res = await receivablesApi.getAging();
      const data = res?.data ?? res ?? [];
      return { data: Array.isArray(data) ? data : [] };
    },
    enabled: reportType === "piutangAging",
  });
  const piutangHistoryQuery = useQuery({
    queryKey: queryKeys.reports("piutangRiwayat", {
      startDate,
      endDate,
      piutangCustomerId,
    }),
    queryFn: async () => {
      const res = await receivablesApi.getHistory({
        start_date: startDate,
        end_date: endDate,
        customer_id: piutangCustomerId || undefined,
      });
      const data = res?.data ?? res ?? [];
      return { data: Array.isArray(data) ? data : [] };
    },
    enabled: reportType === "piutangRiwayat",
  });
  const paymentMethodQuery = useQuery({
    queryKey: queryKeys.reports("metodePembayaran", { startDate, endDate }),
    queryFn: async () => {
      const res = await transactionsApi.getPaymentMethodReport({
        start_date: startDate,
        end_date: endDate,
      });
      return res?.data ?? res ?? null;
    },
    enabled: reportType === "metodePembayaran",
  });
  const voidReportQuery = useQuery({
    queryKey: queryKeys.reports("transaksiVoid", {
      startDate,
      endDate,
      cashierFilter,
    }),
    queryFn: async () => {
      const res = await transactionsApi.getVoidReport({
        start_date: startDate,
        end_date: endDate,
        cashier_name: cashierFilter || undefined,
      });
      return res?.data ?? res ?? null;
    },
    enabled: reportType === "transaksiVoid",
  });

  const queryByType = {
    penjualanHarian: dailyQuery,
    penjualanPeriode: salesQuery,
    penjualan: salesQuery,
    penjualanPelanggan: customerQuery,
    labaProduk: profitQuery,
    kasMasukKeluar: kasQuery,
    cashFlow: cashFlowQuery,
    shiftKasir: shiftQuery,
    barangMasuk: purchaseQuery,
    barangKeluar: stockOutQuery,
    stockOpname: opnameListQuery,
    barangExpired: expiredQuery,
    pembelian: purchaseQuery,
    pembelianSupplier: purchaseQuery,
    hutangSupplier: payableQuery,
    piutangFakturBelumLunas: piutangUnpaidQuery,
    piutangPerPelanggan: piutangPerCustomerQuery,
    piutangAging: piutangAgingQuery,
    piutangRiwayat: piutangHistoryQuery,
    metodePembayaran: paymentMethodQuery,
    transaksiVoid: voidReportQuery,
  };
  const activeQuery = reportType ? queryByType[reportType] : null;

  const loadOpnameDetail = useCallback((id) => {
    setOpnameDetailId(id);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────
  const dailyReport = dailyQuery.data?.data ?? null;
  const kasReport = kasQuery.data?.data ?? null;
  const salesReport = salesQuery.data?.data ?? null;
  const purchaseReport = purchaseQuery.data?.data ?? null;
  const expiredReport = expiredQuery.data?.data ?? null;
  const profitReport = profitQuery.data?.data ?? null;
  const customerReport = customerQuery.data?.data ?? null;
  const cashFlowReport = cashFlowQuery.data?.data ?? cashFlowQuery.data ?? null;
  const shiftReport = shiftQuery.data ?? null;
  const stockOutReport = stockOutQuery.data ?? null;
  const payableReport = payableQuery.data ?? null;

  const opnameReport = useMemo(() => {
    const base = opnameListQuery.data ?? { sessions: [], summary: {} };
    const detail =
      opnameDetailQuery.data?.data ?? opnameDetailQuery.data ?? null;
    return { ...base, selectedDetail: detail };
  }, [opnameListQuery.data, opnameDetailQuery.data]);

  const purchaseList =
    purchaseListQuery.data?.data || purchaseListQuery.data || [];

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
    if (salesSort === "qty")
      arr.sort((a, b) => b.total_qty_base - a.total_qty_base);
    else if (salesSort === "name")
      arr.sort((a, b) => a.name.localeCompare(b.name, "id"));
    else arr.sort((a, b) => b.total_revenue - a.total_revenue);
    return arr;
  }, [salesReport, salesSort]);

  const sortedPurchaseTopProducts = useMemo(() => {
    const arr = [...(purchaseReport?.topProducts || [])];
    if (purchaseSort === "qty") arr.sort((a, b) => b.total_qty - a.total_qty);
    else if (purchaseSort === "name")
      arr.sort((a, b) => a.product_name.localeCompare(b.product_name, "id"));
    else arr.sort((a, b) => b.total_cost - a.total_cost);
    return arr;
  }, [purchaseReport, purchaseSort]);

  const sortedProfitProducts = useMemo(() => {
    const arr = [...(profitReport?.items || [])];
    if (profitSort === "revenue")
      arr.sort((a, b) => b.total_revenue - a.total_revenue);
    else if (profitSort === "qty")
      arr.sort((a, b) => b.total_qty_base - a.total_qty_base);
    else if (profitSort === "margin")
      arr.sort((a, b) => b.margin_percent - a.margin_percent);
    else if (profitSort === "name")
      arr.sort((a, b) => a.name.localeCompare(b.name, "id"));
    else arr.sort((a, b) => b.total_profit - a.total_profit);
    return arr;
  }, [profitReport, profitSort]);

  const sortedCustomers = useMemo(() => {
    const arr = [...(customerReport?.items || [])];
    if (customerSort === "profit")
      arr.sort((a, b) => b.total_profit - a.total_profit);
    else if (customerSort === "transactions")
      arr.sort((a, b) => b.transaction_count - a.transaction_count);
    else if (customerSort === "name")
      arr.sort((a, b) => a.customer_name.localeCompare(b.customer_name, "id"));
    else arr.sort((a, b) => b.total_revenue - a.total_revenue);
    return arr;
  }, [customerReport, customerSort]);

  return {
    reportTypes: REPORT_TYPES,
    reportType,
    selectReportType,
    backToPicker,

    dailyDate,
    setDailyDate,
    dailyReport,
    kasReport,

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
    stockOutJenis,
    setStockOutJenis,

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
    purchaseList,
    expiredReport,
    profitReport,
    customerReport,
    cashFlowReport,
    shiftReport,
    stockOutReport,
    opnameReport,
    payableReport,
    piutangUnpaidReport: piutangUnpaidQuery.data ?? null,
    piutangPerCustomerReport: piutangPerCustomerQuery.data ?? null,
    piutangAgingReport: piutangAgingQuery.data ?? null,
    piutangHistoryReport: piutangHistoryQuery.data ?? null,
    paymentMethodReport: paymentMethodQuery.data ?? null,
    voidReport: voidReportQuery.data ?? null,
    customersList:
      customersListQuery.data?.data ?? customersListQuery.data ?? [],
    cashiersList: cashiersQuery.data?.data ?? cashiersQuery.data ?? [],
    piutangCustomerId,
    setPiutangCustomerId,
    cashierFilter,
    setCashierFilter,
    loadOpnameDetail,

    salesChartData,
    purchaseChartData,
    sortedSalesTopProducts,
    sortedPurchaseTopProducts,
    sortedProfitProducts,
    sortedCustomers,
    storeSettings: storeSettingsQuery.data?.data ?? {},
    loading:
      activeQuery?.isLoading ||
      (reportType === "stockOpname" && opnameDetailQuery.isLoading) ||
      false,
    reload: () => activeQuery?.refetch(),
  };
}
