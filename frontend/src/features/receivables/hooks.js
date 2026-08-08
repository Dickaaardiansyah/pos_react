// src/features/receivables/hooks.js
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { receivablesApi } from "./api";
import { customersApi } from "../customers/api";
import { queryKeys } from "../../lib/queryClient";

export function useReceivables() {
  const [tab, setTab] = useState("unpaid"); // unpaid | per_customer | aging | history
  const [search, setSearch] = useState("");
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const [historyCustomer, setHistoryCustomer] = useState("");
  const queryClient = useQueryClient();

  // Drill-down "Menu Open Bill": pilih pelanggan → daftar tagihan pelanggan itu.
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [loadingCustomerInvoices, setLoadingCustomerInvoices] = useState(false);

  const customersQuery = useQuery({ queryKey: queryKeys.customers({}), queryFn: () => customersApi.getAll({}) });
  const summaryQuery = useQuery({ queryKey: ["receivables", "summary"], queryFn: () => receivablesApi.getSummary() });

  const unpaidQuery = useQuery({ queryKey: ["receivables", "unpaid"], queryFn: () => receivablesApi.getUnpaid(), enabled: tab === "unpaid" });
  const perCustomerQuery = useQuery({
    queryKey: ["receivables", "per-customer"],
    queryFn: () => receivablesApi.getUnpaidPerCustomer(),
    enabled: tab === "per_customer",
  });
  const agingQuery = useQuery({ queryKey: ["receivables", "aging"], queryFn: () => receivablesApi.getAging(), enabled: tab === "aging" });
  const historyQuery = useQuery({
    queryKey: ["receivables", "history", { historyStart, historyEnd, historyCustomer }],
    queryFn: () => receivablesApi.getHistory({ start_date: historyStart, end_date: historyEnd, customer_id: historyCustomer }),
    enabled: tab === "history",
  });

  const activeQuery = { unpaid: unpaidQuery, per_customer: perCustomerQuery, aging: agingQuery, history: historyQuery }[tab];

  function reload() {
    activeQuery.refetch();
    summaryQuery.refetch();
  }

  // Reset drill-down setiap kali pindah tab supaya tidak "nyangkut" di
  // daftar tagihan pelanggan lain saat balik ke tab per-pelanggan.
  useEffect(() => {
    setSelectedCustomer(null);
    setCustomerInvoices([]);
  }, [tab]);

  const openCustomerInvoices = useCallback(async (customer) => {
    setSelectedCustomer(customer);
    setLoadingCustomerInvoices(true);
    try {
      const res = await receivablesApi.getUnpaid({ customer_id: customer.customer_id });
      setCustomerInvoices(res.data);
    } catch (e) {
      toast.error(e.message || "Gagal memuat tagihan pelanggan");
    } finally {
      setLoadingCustomerInvoices(false);
    }
  }, []);

  const closeCustomerInvoices = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerInvoices([]);
  }, []);

  const reloadCustomerInvoices = useCallback(() => {
    if (selectedCustomer) openCustomerInvoices(selectedCustomer);
  }, [selectedCustomer, openCustomerInvoices]);

  const removeMutation = useMutation({
    mutationFn: (receivable) => receivablesApi.remove(receivable.id),
    onSuccess: () => {
      toast.success("Piutang berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: (e) => toast.error(e.message || "Gagal menghapus piutang"),
  });
  function removeReceivable(receivable) {
    if (!window.confirm(`Hapus faktur piutang "${receivable.invoice_code}"?`)) return;
    removeMutation.mutate(receivable);
  }

  const unpaid = unpaidQuery.data?.data ?? [];
  const filteredUnpaid = search
    ? unpaid.filter(
        (r) => r.invoice_code.toLowerCase().includes(search.toLowerCase()) || r.customer_name.toLowerCase().includes(search.toLowerCase()),
      )
    : unpaid;

  return {
    tab,
    setTab,
    search,
    setSearch,
    customers: customersQuery.data?.data ?? [],
    unpaid: filteredUnpaid,
    perCustomer: perCustomerQuery.data?.data ?? [],
    aging: agingQuery.data?.data ?? [],
    history: historyQuery.data?.data ?? [],
    summary: summaryQuery.data?.data ?? null,
    historyStart,
    setHistoryStart,
    historyEnd,
    setHistoryEnd,
    historyCustomer,
    setHistoryCustomer,
    loading: activeQuery.isLoading,
    reload,
    removeReceivable,
    selectedCustomer,
    customerInvoices,
    loadingCustomerInvoices,
    openCustomerInvoices,
    closeCustomerInvoices,
    reloadCustomerInvoices,
  };
}

export function useReceivableForm({ customers, onSuccess, onClose }) {
  const [form, setForm] = useState({
    customer_id: "",
    customer_name: "",
    amount: "",
    paid_amount: "0",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
  });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => receivablesApi.create(form),
    onSuccess: () => {
      toast.success("Piutang berhasil dicatat");
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(e.message || "Gagal mencatat piutang"),
  });

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function selectCustomer(customerId) {
    const c = customers.find((c) => String(c.id) === String(customerId));
    setForm((f) => ({ ...f, customer_id: customerId, customer_name: c ? c.name : f.customer_name }));
  }
  function submit(e) {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      toast.error("Nama pelanggan wajib diisi");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Jumlah piutang harus lebih dari 0");
      return;
    }
    if (!form.due_date) {
      toast.error("Tanggal jatuh tempo wajib diisi");
      return;
    }
    mutation.mutate();
  }

  return { form, setField, selectCustomer, saving: mutation.isPending, submit };
}

export function useReceivablePayment({ receivable, onSuccess, onClose }) {
  const sisa = receivable ? Number(receivable.amount) - Number(receivable.paid_amount) : 0;
  const [form, setForm] = useState({
    amount: sisa > 0 ? String(sisa) : "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    notes: "",
  });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => receivablesApi.recordPayment(receivable.id, form),
    onSuccess: () => {
      toast.success("Pembayaran berhasil dicatat");
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
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
