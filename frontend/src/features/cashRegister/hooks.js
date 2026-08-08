// src/features/cashRegister/hooks.js
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { cashRegisterApi } from "./api";
import { useAuth } from "../../context/AuthContext";
import { useShift } from "../../context/ShiftContext";
import { queryKeys } from "../../lib/queryClient";

export function useCashRegister() {
  const { user, isAdmin } = useAuth();
  // Admin tidak boleh akses "Kas Berjalan" — langsung ke tab Riwayat Tutup Kas.
  const [tab, setTab] = useState(isAdmin ? "riwayat" : "kas");

  // Sesi kas aktif — didelegasikan ke ShiftContext supaya statusnya konsisten
  // dengan Sidebar & halaman Kasir tanpa fetch berulang.
  const { shift, loading, reload, opening, openShift, closing, closeShift, closeResult, setCloseResult } = useShift();

  const cashOutQuery = useQuery({ queryKey: queryKeys.cashRegisterCategories(), queryFn: () => cashRegisterApi.getCashOutCategories() });
  const cashInQuery = useQuery({ queryKey: ["cash-register", "cash-in-categories"], queryFn: () => cashRegisterApi.getCashInCategories() });

  const queryClient = useQueryClient();
  const movementMutation = useMutation({
    mutationFn: ({ type, category, amount, description }) =>
      cashRegisterApi.createMovement({ type, category, amount: Number(amount), description, created_by: user?.name || "Admin" }),
    onSuccess: (_data, { type }) => {
      reload();
      toast.success(type === "out" ? "Pengeluaran kas tercatat" : "Pemasukan kas tercatat");
    },
  });

  async function addMovement({ type, category, amount, description }) {
    if (!category) {
      toast.error("Pilih kategori terlebih dahulu");
      return false;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Jumlah harus lebih dari 0");
      return false;
    }
    try {
      await movementMutation.mutateAsync({ type, category, amount, description });
      return true;
    } catch {
      return false;
    }
  }

  async function deleteMovement(id) {
    try {
      await cashRegisterApi.deleteMovement(id);
      reload();
      toast.success("Catatan kas dihapus");
    } catch (e) {
      toast.error(e.message);
    }
  }

  // ─── Riwayat sesi kas ───────────────────────────────────────────────────
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const historyQuery = useQuery({
    queryKey: queryKeys.cashRegisterHistory({ page: historyPage }),
    queryFn: () => cashRegisterApi.history({ page: historyPage, limit: 20 }),
    enabled: tab === "riwayat",
  });

  async function viewHistoryDetail(id) {
    try {
      const res = await cashRegisterApi.getById(id);
      setSelectedHistory(res.data);
    } catch {
      toast.error("Gagal memuat detail sesi kas");
    }
  }

  return {
    tab,
    setTab,
    shift,
    loading,
    cashOutCategories: cashOutQuery.data?.data ?? [],
    cashInCategories: cashInQuery.data?.data ?? [],
    reload,

    opening,
    openShift,

    movementSubmitting: movementMutation.isPending,
    addMovement,
    deleteMovement,

    closing,
    closeShift,
    closeResult,
    setCloseResult,

    history: historyQuery.data?.data ?? [],
    historyTotal: historyQuery.data?.total ?? 0,
    historyPage,
    setHistoryPage,
    historyLoading: historyQuery.isLoading,
    selectedHistory,
    setSelectedHistory,
    viewHistoryDetail,
  };
}
