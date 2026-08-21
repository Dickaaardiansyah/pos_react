// src/features/transactions/hooks.js
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { transactionsApi } from "./api";
import { settingsApi } from "../settings/api";
import { printReceiptSmart } from "../../utils/printReceipt";
import { usePrinterContext } from "../../context/PrinterContext";
import { useAuth } from "../../context/AuthContext";
import { toDateKey } from "../../utils/format";
import { queryKeys } from "../../lib/queryClient";

// YYYY-MM-DD sesuai zona waktu lokal perangkat (bukan toISOString yang UTC,
// supaya tanggal "hari ini" tidak meleset jadi kemarin/besok dekat tengah malam).
function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Riwayat dikelompokkan per hari (lihat groupedByDate), jadi tidak memakai
// pagination halaman-per-halaman — cukup ambil sekaligus dalam jumlah besar.
const FETCH_LIMIT = 1000;

export function useTransactions() {
  const { user, isAdmin } = useAuth();
  // Drill-down dari Dashboard datang lewat query param ?start_date=&end_date=
  // — kalau ada, langsung dipakai sebagai filter awal (mode "custom").
  const [searchParams] = useSearchParams();
  const drillStart = searchParams.get("start_date");
  const drillEnd = searchParams.get("end_date");
  const hasDrillDown = !!(drillStart || drillEnd);
  // FIX (revisi dosen — poin 1, traceability jurnal → transaksi asal):
  // link "lihat transaksi" dari Jurnal Umum membawa ?search=<kode> supaya
  // transaksi asalnya langsung ketemu di sini tanpa perlu dicari manual.
  const linkedSearch = searchParams.get("search") || "";

  const [quickFilter, setQuickFilterRaw] = useState(
    hasDrillDown ? "custom" : "today",
  );
  const [startDate, setStartDate] = useState(
    drillStart || drillEnd || todayStr(),
  );
  const [endDate, setEndDate] = useState(drillEnd || drillStart || todayStr());
  const [paymentMethod, setPaymentMethod] = useState("");
  // Kalau datang dari link Jurnal Umum, defaultkan status ke "" (semua
  // status) supaya transaksi yang dibatalkan (void) tetap ketemu, bukan
  // cuma yang "completed".
  const [statusFilter, setStatusFilter] = useState(
    linkedSearch ? "" : "completed",
  );
  const [search, setSearch] = useState(linkedSearch);
  const [selectedId, setSelectedId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  const printer = usePrinterContext();
  const queryClient = useQueryClient();

  const storeSettingsQuery = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => settingsApi.get(),
  });

  const filters = { startDate, endDate, paymentMethod, statusFilter };
  const listQuery = useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () =>
      transactionsApi.list({
        start_date: startDate,
        end_date: endDate,
        payment_method: paymentMethod,
        status: statusFilter,
        page: 1,
        limit: FETCH_LIMIT,
      }),
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.transaction(selectedId),
    queryFn: () => transactionsApi.getById(selectedId),
    enabled: !!selectedId,
  });

  const transactions = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const summary = listQuery.data?.summary ?? {
    total_transactions: total,
    total_revenue: 0,
  };

  // Pencarian bebas teks dilakukan di sisi client terhadap data yang sudah
  // di-fetch sesuai filter tanggal/metode/status aktif — cocok dengan kode
  // transaksi, nama kasir, atau nama pelanggan.
  const searchedTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter((tx) => {
      const code = (tx.transaction_code || "").toLowerCase();
      const cashier = (tx.cashier_name || "").toLowerCase();
      const customer = (tx.customer_name || "").toLowerCase();
      return (
        code.includes(term) || cashier.includes(term) || customer.includes(term)
      );
    });
  }, [transactions, search]);

  // Mengelompokkan transaksi (sudah terurut terbaru → terlama dari backend)
  // per tanggal lokal, masing-masing dengan total & jumlah transaksi hari itu.
  const groupedByDate = useMemo(() => {
    const map = new Map();
    for (const tx of searchedTransactions) {
      const key = toDateKey(tx.created_at);
      if (!map.has(key))
        map.set(key, {
          dateKey: key,
          date: tx.created_at,
          transactions: [],
          total: 0,
        });
      const group = map.get(key);
      group.transactions.push(tx);
      group.total += Number(tx.final_amount) || 0;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.dateKey < b.dateKey ? 1 : -1,
    );
  }, [searchedTransactions]);

  function toggleGroup(dateKey) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  function changeQuickFilter(mode) {
    setQuickFilterRaw(mode);
    if (mode === "today") {
      setStartDate(todayStr());
      setEndDate(todayStr());
    } else if (mode === "all") {
      setStartDate("");
      setEndDate("");
    } else if (mode === "custom") {
      setStartDate((d) => d || todayStr());
      setEndDate((d) => d || todayStr());
    }
  }

  function viewDetail(id) {
    setSelectedId(id);
  }
  function closeDetail() {
    setSelectedId(null);
  }

  async function printReceipt(transaction) {
    await printReceiptSmart(
      transaction,
      storeSettingsQuery.data?.data ?? {},
      printer,
    );
  }

  function openVoidModal(tx) {
    setVoidTarget(tx);
    setVoidReason("");
  }
  const [voidLoading, setVoidLoading] = useState(false);
  function closeVoidModal() {
    if (voidLoading) return;
    setVoidTarget(null);
    setVoidReason("");
  }

  async function confirmVoid() {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      toast.error("Alasan pembatalan wajib diisi");
      return;
    }
    setVoidLoading(true);
    try {
      if (isAdmin) {
        // Admin adalah otoritas persetujuan itu sendiri — void langsung
        // dieksekusi (backend: routes/transaction.routes.js POST .../void,
        // authorize("admin")).
        await transactionsApi.void(voidTarget.id, voidReason.trim());
        toast.success("Transaksi berhasil dibatalkan");
      } else {
        // Kasir hanya bisa MENGAJUKAN — backend memvalidasi kepemilikan,
        // shift, rentang waktu, dan status akun aktif sebelum mengizinkan
        // pengajuan tersimpan (lihat services/voidRequestService.js).
        // Eksekusi void sebenarnya baru terjadi setelah admin menyetujui.
        await transactionsApi.requestVoid(voidTarget.id, voidReason.trim());
        toast.success(
          "Pengajuan pembatalan terkirim, menunggu persetujuan admin",
        );
      }
      setVoidTarget(null);
      setVoidReason("");
      closeDetail();
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["void-requests"] });
    } catch (err) {
      toast.error(err.message || "Gagal memproses pembatalan");
    } finally {
      setVoidLoading(false);
    }
  }

  function resetFilters() {
    // "Reset" kembali ke kondisi default (hari ini), bukan mengosongkan
    // tanggal — supaya tabel tidak mendadak menampilkan seluruh riwayat.
    changeQuickFilter("today");
    setPaymentMethod("");
    setStatusFilter("completed");
    setSearch("");
  }

  return {
    transactions: searchedTransactions,
    total: search.trim() ? searchedTransactions.length : total,
    summary,
    search,
    setSearch,
    loading: listQuery.isLoading,
    quickFilter,
    startDate,
    endDate,
    paymentMethod,
    statusFilter,
    selected: detailQuery.data?.data ?? null,
    loadingDetail: detailQuery.isLoading,
    printer,
    storeSettings: storeSettingsQuery.data?.data ?? {},
    groupedByDate,
    collapsedGroups,
    toggleGroup,
    setQuickFilter: changeQuickFilter,
    setStartDate,
    setEndDate,
    setPaymentMethod,
    setStatusFilter,
    viewDetail,
    closeDetail,
    resetFilters,
    reload: listQuery.refetch,
    printReceipt,
    voidTarget,
    voidReason,
    voidLoading,
    setVoidReason,
    openVoidModal,
    closeVoidModal,
    confirmVoid,
    isAdmin,
    currentUserId: user?.id,
  };
}

// Panel persetujuan void — hanya relevan untuk admin (kasir hanya melihat
// status pengajuannya sendiri lewat daftar yang sama, tapi tanpa tombol
// approve/reject; backend menolak kalau kasir mencoba memanggilnya).
export function useVoidRequests() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const listQuery = useQuery({
    queryKey: ["void-requests", statusFilter],
    queryFn: () => transactionsApi.listVoidRequests(statusFilter || undefined),
  });

  async function approve(id, note) {
    setActionLoadingId(id);
    try {
      await transactionsApi.approveVoidRequest(id, note);
      toast.success("Pengajuan disetujui, transaksi berhasil dibatalkan");
      queryClient.invalidateQueries({ queryKey: ["void-requests"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch (err) {
      toast.error(err.message || "Gagal menyetujui pengajuan");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function reject(id, note) {
    if (!note?.trim()) {
      toast.error("Catatan penolakan wajib diisi");
      return;
    }
    setActionLoadingId(id);
    try {
      await transactionsApi.rejectVoidRequest(id, note.trim());
      toast.success("Pengajuan void ditolak");
      queryClient.invalidateQueries({ queryKey: ["void-requests"] });
    } catch (err) {
      toast.error(err.message || "Gagal menolak pengajuan");
    } finally {
      setActionLoadingId(null);
    }
  }

  return {
    isAdmin,
    requests: listQuery.data?.data ?? [],
    loading: listQuery.isLoading,
    statusFilter,
    setStatusFilter,
    actionLoadingId,
    approve,
    reject,
    reload: listQuery.refetch,
  };
}
