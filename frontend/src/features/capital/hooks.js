// src/features/capital/hooks.js
// ─────────────────────────────────────────────────────────────────────────────
// Dipisah dari features/journal/hooks.js supaya Modal Usaha jadi menu sendiri
// di sidebar, terpisah dari Jurnal Akuntansi (Jurnal Umum/Buku Besar/Neraca/
// Arus Kas/COA tetap satu paket karena memang saling terkait erat sebagai
// "buku besar", sedangkan Modal Usaha lebih ke pencatatan setoran/penarikan
// pemilik — cukup berdiri sendiri).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { capitalApi } from "./api";

function today() {
  return new Date().toISOString().split("T")[0];
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
        amount: "",
        description: "",
      });
      queryClient.invalidateQueries({ queryKey: ["capital"] });
    },
  });

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

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
    try {
      await mutation.mutateAsync({
        transaction_date: form.transaction_date,
        type: isInitial ? "setoran" : form.type,
        target_account: form.target_account,
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
  };
}
