// src/features/capital/hooks.js
// ─────────────────────────────────────────────────────────────────────────────
// Dipisah dari features/journal/hooks.js supaya Modal Usaha jadi menu sendiri
// di sidebar, terpisah dari Jurnal Akuntansi (Jurnal Umum/Buku Besar/Neraca/
// Arus Kas/COA tetap satu paket karena memang saling terkait erat sebagai
// "buku besar", sedangkan Modal Usaha lebih ke pencatatan setoran/penarikan
// pemilik — cukup berdiri sendiri).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { capitalApi } from "./api";
import { journalApi } from "../journal/api";
import { cashRegisterApi } from "../cashRegister/api";
import { queryKeys } from "../../lib/queryClient";

function today() {
  return new Date().toISOString().split("T")[0];
}
function firstDayOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

export function useCapital() {
  const queryClient = useQueryClient();

  const [txPage, setTxPage] = useState(1);
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("");
  const [form, setForm] = useState({
    transaction_date: today(),
    type: "setoran",
    target_account: "kas",
    payment_source: "laci",
    shift_id: "",
    amount: "",
    description: "",
  });

  const summaryQuery = useQuery({
    queryKey: ["capital", "summary"],
    queryFn: () => capitalApi.getSummary(),
    // Ringkasan ekuitas ini gampang berubah dari modul lain (pembelian,
    // penjualan, kas kecil, utang manual) yang tidak meng-invalidate query
    // key ini secara eksplisit. staleTime 0 memastikan tiap halaman Modal
    // Usaha dibuka, angkanya SELALU dihitung ulang dari server saat itu.
    staleTime: 0,
  });

  // ─── Laporan Perubahan Modal (per periode) ─────────────────────────────
  const [equityStartDate, setEquityStartDate] = useState(firstDayOfMonth());
  const [equityEndDate, setEquityEndDate] = useState(today());
  const equityStatementQuery = useQuery({
    queryKey: [
      "capital",
      "equity-statement",
      { equityStartDate, equityEndDate },
    ],
    queryFn: () =>
      capitalApi.getEquityStatement({
        start_date: equityStartDate || undefined,
        end_date: equityEndDate || undefined,
      }),
    staleTime: 0,
  });
  const txQuery = useQuery({
    queryKey: ["capital", "transactions", { txPage, txSearch, txTypeFilter }],
    queryFn: () =>
      capitalApi.getTransactions({
        page: txPage,
        limit: 20,
        search: txSearch || undefined,
        type: txTypeFilter || undefined,
      }),
  });

  const mutation = useMutation({
    mutationFn: (payload) => capitalApi.createTransaction(payload),
    onSuccess: (_data, { is_initial }) => {
      toast.success(
        is_initial
          ? "Modal awal berhasil dicatat"
          : "Transaksi modal berhasil dicatat",
      );
      setForm({
        transaction_date: today(),
        type: "setoran",
        target_account: "kas",
        payment_source: "laci",
        shift_id: "",
        amount: "",
        description: "",
      });
      queryClient.invalidateQueries({ queryKey: ["capital"] });
    },
  });

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // ── Sumber dana laci/kantor (hanya relevan kalau target_account==='kas') ─
  const relevantForBalance = form.target_account === "kas";
  const cashBalancesQuery = useQuery({
    queryKey: queryKeys.journalCashBalances(),
    queryFn: () => journalApi.getCashBalances(),
    enabled: relevantForBalance && form.payment_source === "kantor",
  });
  const openShiftsQuery = useQuery({
    queryKey: queryKeys.cashRegisterOpenShifts(),
    queryFn: () => cashRegisterApi.getOpenShifts(),
    enabled: relevantForBalance && form.payment_source === "laci",
  });
  const openShifts = openShiftsQuery.data?.data ?? [];

  useEffect(() => {
    if (!relevantForBalance || form.payment_source !== "laci") return;
    if (openShifts.length === 1 && !form.shift_id) {
      setForm((f) => ({ ...f, shift_id: String(openShifts[0].id) }));
    }
    if (
      form.shift_id &&
      !openShifts.some((sh) => String(sh.id) === form.shift_id)
    ) {
      setForm((f) => ({ ...f, shift_id: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantForBalance, form.payment_source, openShifts.length]);

  const selectedShift = openShifts.find(
    (sh) => String(sh.id) === form.shift_id,
  );
  const cashBalances = cashBalancesQuery.data?.data ?? null;
  const balanceLoading =
    relevantForBalance &&
    ((form.payment_source === "kantor" && cashBalancesQuery.isLoading) ||
      (form.payment_source === "laci" && openShiftsQuery.isLoading));
  const availableBalance = !relevantForBalance
    ? null
    : form.payment_source === "laci"
      ? selectedShift
        ? Number(selectedShift.expected_balance)
        : null
      : cashBalances
        ? Number(cashBalances[form.target_account] ?? 0)
        : null;

  // Reset ke halaman 1 tiap kali search/filter jenis berubah — supaya tidak
  // "nyangkut" di halaman lama yang mungkin sudah kosong hasil filternya.
  function updateTxSearch(value) {
    setTxSearch(value);
    setTxPage(1);
  }
  function updateTxTypeFilter(value) {
    setTxTypeFilter(value);
    setTxPage(1);
  }

  async function submit(isInitial) {
    if (!form.transaction_date) {
      toast.error("Tanggal wajib diisi");
      return false;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Jumlah harus lebih dari 0");
      return false;
    }
    if (
      form.target_account === "kas" &&
      form.payment_source === "laci" &&
      !form.shift_id
    ) {
      toast.error(
        openShifts.length === 0
          ? 'Tidak ada sesi kas (laci) yang sedang terbuka. Buka sesi kas dulu, atau pilih sumber dana "Kas Kantor".'
          : "Pilih laci kasir mana yang dipakai untuk transaksi modal ini",
      );
      return false;
    }
    try {
      await mutation.mutateAsync({
        transaction_date: form.transaction_date,
        type: isInitial ? "setoran" : form.type,
        target_account: form.target_account,
        payment_source:
          form.target_account === "kas" ? form.payment_source : undefined,
        shift_id:
          form.target_account === "kas" && form.payment_source === "laci"
            ? form.shift_id
            : undefined,
        amount: Number(form.amount),
        description: form.description,
        is_initial: !!isInitial,
      });
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  }

  return {
    summary: summaryQuery.data?.data ?? null,
    summaryLoading: summaryQuery.isLoading,

    equityStartDate,
    setEquityStartDate,
    equityEndDate,
    setEquityEndDate,
    equityStatement: equityStatementQuery.data?.data ?? null,
    equityStatementLoading: equityStatementQuery.isLoading,

    tx: txQuery.data?.data ?? [],
    txTotal: txQuery.data?.total ?? 0,
    txPage,
    setTxPage,
    txSearch,
    updateTxSearch,
    txTypeFilter,
    updateTxTypeFilter,
    txLoading: txQuery.isLoading,
    form,
    updateForm,
    submitting: mutation.isPending,
    submit,

    openShifts,
    selectedShift,
    cashBalances,
    availableBalance,
    balanceLoading,
  };
}
