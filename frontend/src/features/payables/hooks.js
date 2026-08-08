// src/features/payables/hooks.js
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { payablesApi } from "./api";
import { purchaseApi } from "../purchase/api";
import { settingsApi } from "../settings/api";
import { printBuktiHutang } from "../../utils/printBuktiHutang";
import { queryKeys } from "../../lib/queryClient";

export function usePayables() {
  const [tab, setTab] = useState("unpaid"); // unpaid | per_supplier | aging | history
  const [search, setSearch] = useState("");
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const [historySupplier, setHistorySupplier] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailMode, setDetailMode] = useState(null); // 'detail' | 'history' | null
  const [detailLoading, setDetailLoading] = useState(false);
  const queryClient = useQueryClient();

  const suppliersQuery = useQuery({ queryKey: queryKeys.suppliers(), queryFn: () => purchaseApi.listSuppliers() });
  const summaryQuery = useQuery({ queryKey: ["payables", "summary"], queryFn: () => payablesApi.getSummary() });
  const storeSettingsQuery = useQuery({ queryKey: queryKeys.settings(), queryFn: () => settingsApi.get() });

  const unpaidQuery = useQuery({
    queryKey: ["payables", "unpaid"],
    queryFn: () => payablesApi.getUnpaid(),
    enabled: tab === "unpaid",
  });
  const perSupplierQuery = useQuery({
    queryKey: ["payables", "per-supplier"],
    queryFn: () => payablesApi.getUnpaidPerSupplier(),
    enabled: tab === "per_supplier",
  });
  const agingQuery = useQuery({
    queryKey: ["payables", "aging"],
    queryFn: () => payablesApi.getAging(),
    enabled: tab === "aging",
  });
  const historyQuery = useQuery({
    queryKey: ["payables", "history", { historyStart, historyEnd, historySupplier }],
    queryFn: () => payablesApi.getHistory({ start_date: historyStart, end_date: historyEnd, supplier_id: historySupplier }),
    enabled: tab === "history",
  });

  const activeQuery = { unpaid: unpaidQuery, per_supplier: perSupplierQuery, aging: agingQuery, history: historyQuery }[tab];

  function reload() {
    activeQuery.refetch();
    summaryQuery.refetch();
  }

  const removeMutation = useMutation({
    mutationFn: (payable) => payablesApi.remove(payable.id),
    onSuccess: () => {
      toast.success("Hutang berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["payables"] });
    },
    onError: (e) => toast.error(e.message || "Gagal menghapus hutang"),
  });
  function removePayable(payable) {
    if (!window.confirm(`Hapus faktur hutang "${payable.invoice_code}"?`)) return;
    removeMutation.mutate(payable);
  }

  async function fetchDetail(payable, mode) {
    setDetailMode(mode);
    setDetailLoading(true);
    try {
      const res = await payablesApi.getById(payable.id);
      setDetail(res.data);
    } catch (e) {
      toast.error(e.message || "Gagal memuat detail hutang");
      setDetailMode(null);
    } finally {
      setDetailLoading(false);
    }
  }
  function openDetail(payable) {
    fetchDetail(payable, "detail");
  }
  function openHistory(payable) {
    fetchDetail(payable, "history");
  }
  function closeDetail() {
    setDetail(null);
    setDetailMode(null);
  }

  async function printBukti(payable) {
    try {
      const res = await payablesApi.getById(payable.id);
      printBuktiHutang(res.data, storeSettingsQuery.data?.data ?? {});
    } catch (e) {
      toast.error(e.message || "Gagal menyiapkan bukti hutang");
    }
  }

  const unpaid = unpaidQuery.data?.data ?? [];
  const filteredUnpaid = search
    ? unpaid.filter(
        (p) => p.invoice_code.toLowerCase().includes(search.toLowerCase()) || p.supplier_name.toLowerCase().includes(search.toLowerCase()),
      )
    : unpaid;

  return {
    tab,
    setTab,
    search,
    setSearch,
    suppliers: suppliersQuery.data?.data ?? [],
    unpaid: filteredUnpaid,
    perSupplier: perSupplierQuery.data?.data ?? [],
    aging: agingQuery.data?.data ?? [],
    history: historyQuery.data?.data ?? [],
    summary: summaryQuery.data?.data ?? null,
    historyStart,
    setHistoryStart,
    historyEnd,
    setHistoryEnd,
    historySupplier,
    setHistorySupplier,
    loading: activeQuery.isLoading,
    reload,
    removePayable,
    detail,
    detailMode,
    detailLoading,
    openDetail,
    openHistory,
    closeDetail,
    printBukti,
  };
}

export function usePayableForm({ suppliers, onSuccess, onClose }) {
  const [form, setForm] = useState({
    supplier_id: "",
    supplier_name: "",
    amount: "",
    paid_amount: "0",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
  });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => payablesApi.create(form),
    onSuccess: () => {
      toast.success("Hutang berhasil dicatat");
      queryClient.invalidateQueries({ queryKey: ["payables"] });
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Gagal mencatat hutang"),
  });

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function selectSupplier(supplierId) {
    const s = suppliers.find((s) => String(s.id) === String(supplierId));
    setForm((f) => ({ ...f, supplier_id: supplierId, supplier_name: s ? s.name : f.supplier_name }));
  }
  function submit(e) {
    e.preventDefault();
    if (!form.supplier_name.trim()) {
      toast.error("Nama pemasok wajib diisi");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Jumlah hutang harus lebih dari 0");
      return;
    }
    if (!form.due_date) {
      toast.error("Tanggal jatuh tempo wajib diisi");
      return;
    }
    mutation.mutate();
  }

  return { form, setField, selectSupplier, saving: mutation.isPending, submit };
}

export function usePayablePayment({ payable, onSuccess, onClose }) {
  const sisa = payable ? Number(payable.amount) - Number(payable.paid_amount) : 0;
  const [form, setForm] = useState({
    amount: sisa > 0 ? String(sisa) : "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    notes: "",
  });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => payablesApi.recordPayment(payable.id, form),
    onSuccess: () => {
      toast.success("Pembayaran berhasil dicatat");
      queryClient.invalidateQueries({ queryKey: ["payables"] });
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Gagal mencatat pembayaran"),
  });

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function submit(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Jumlah pembayaran harus lebih dari 0");
      return;
    }
    mutation.mutate();
  }

  return { form, setField, saving: mutation.isPending, submit, sisa };
}
