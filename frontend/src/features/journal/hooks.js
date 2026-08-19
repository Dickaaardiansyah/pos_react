// src/features/journal/hooks.js
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { journalApi } from "./api";
import { useAuth } from "../../context/AuthContext";

function today() {
  return new Date().toISOString().split("T")[0];
}
function firstDayOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

export function useJournal() {
  const { user } = useAuth();
  const [tab, setTab] = useState("jurnal"); // coa | jurnal | buku-besar | neraca-saldo | neraca | arus-kas
  // Catatan penamaan: "neraca-saldo" = Neraca Saldo (Trial Balance, daftar
  // MENTAH semua akun untuk cek debit=kredit). "neraca" = Neraca (Balance
  // Sheet, laporan posisi keuangan Aset = Kewajiban + Modal) — dua laporan
  // yang berbeda meski namanya mirip.
  const queryClient = useQueryClient();

  // ─── Chart of Accounts ───────────────────────────────────────────────
  const accountsQuery = useQuery({
    queryKey: ["journal", "accounts"],
    queryFn: () => journalApi.getAccounts(),
  });
  const createAccountMutation = useMutation({
    mutationFn: (payload) => journalApi.createAccount(payload),
    onSuccess: () => {
      toast.success("Akun berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: ["journal", "accounts"] });
    },
  });
  async function createAccount(payload) {
    try {
      await createAccountMutation.mutateAsync(payload);
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  }

  // ─── Jurnal Umum ───────────────────────────────────────────────────────
  const [entriesPage, setEntriesPage] = useState(1);
  const [referenceTypeFilter, setReferenceTypeFilter] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);

  const entriesQuery = useQuery({
    queryKey: ["journal", "entries", { entriesPage, referenceTypeFilter }],
    queryFn: () =>
      journalApi.getEntries({
        page: entriesPage,
        limit: 20,
        reference_type: referenceTypeFilter || undefined,
      }),
    enabled: tab === "jurnal",
  });

  async function viewEntryDetail(id) {
    try {
      const res = await journalApi.getEntryDetail(id);
      setSelectedEntry(res.data);
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function deleteEntry(id) {
    try {
      await journalApi.deleteEntry(id);
      toast.success("Jurnal dihapus");
      queryClient.invalidateQueries({ queryKey: ["journal", "entries"] });
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function reverseEntry(id) {
    try {
      await journalApi.reverseEntry(id, {
        entry_date: today(),
        created_by: user?.name || "Admin",
      });
      toast.success("Jurnal pembalik berhasil diposting");
      queryClient.invalidateQueries({ queryKey: ["journal", "entries"] });
    } catch (e) {
      toast.error(e.message);
    }
  }

  // ─── Input Jurnal Manual ─────────────────────────────────────────────
  const [manualDate, setManualDate] = useState(today());
  const [manualDescription, setManualDescription] = useState("");
  const [manualLines, setManualLines] = useState([
    { account_code: "", debit: "", credit: "", description: "" },
    { account_code: "", debit: "", credit: "", description: "" },
  ]);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  function addManualLine() {
    setManualLines((prev) => [
      ...prev,
      { account_code: "", debit: "", credit: "", description: "" },
    ]);
  }
  function updateManualLine(index, field, value) {
    setManualLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    );
  }
  function removeManualLine(index) {
    setManualLines((prev) => prev.filter((_, i) => i !== index));
  }

  const manualTotalDebit = manualLines.reduce(
    (s, l) => s + (Number(l.debit) || 0),
    0,
  );
  const manualTotalCredit = manualLines.reduce(
    (s, l) => s + (Number(l.credit) || 0),
    0,
  );
  const manualIsBalanced =
    Math.abs(manualTotalDebit - manualTotalCredit) < 0.01 &&
    manualTotalDebit > 0;

  async function submitManualEntry() {
    if (!manualDate) {
      toast.error("Tanggal jurnal wajib diisi");
      return false;
    }
    if (!manualIsBalanced) {
      toast.error(
        "Jurnal belum balance — total debit harus sama dengan total kredit",
      );
      return false;
    }
    setManualSubmitting(true);
    try {
      await journalApi.createManualEntry({
        entry_date: manualDate,
        description: manualDescription,
        created_by: user?.name || "Admin",
        lines: manualLines
          .filter((l) => Number(l.debit) > 0 || Number(l.credit) > 0)
          .map((l) => ({
            account_code: l.account_code,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description,
          })),
      });
      toast.success("Jurnal manual berhasil diposting");
      setManualDescription("");
      setManualLines([
        { account_code: "", debit: "", credit: "", description: "" },
        { account_code: "", debit: "", credit: "", description: "" },
      ]);
      queryClient.invalidateQueries({ queryKey: ["journal", "entries"] });
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setManualSubmitting(false);
    }
  }

  // ─── Jurnal Penyesuaian ────────────────────────────────────────────────
  const templatesQuery = useQuery({
    queryKey: ["journal", "adjustment-templates"],
    queryFn: () => journalApi.getAdjustmentTemplates(),
    enabled: tab === "penyesuaian",
    staleTime: Infinity,
  });

  const [adjTemplateId, setAdjTemplateId] = useState("");
  const [adjDate, setAdjDate] = useState(today());
  const [adjDescription, setAdjDescription] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  const adjTemplates = templatesQuery.data?.data ?? [];
  const adjSelectedTemplate =
    adjTemplates.find((t) => t.id === adjTemplateId) || null;

  function selectAdjTemplate(templateId) {
    setAdjTemplateId(templateId);
    const tpl = adjTemplates.find((t) => t.id === templateId);
    setAdjDescription(tpl ? tpl.label : "");
  }

  async function submitAdjustingEntry() {
    if (!adjSelectedTemplate) {
      toast.error("Pilih jenis penyesuaian terlebih dahulu");
      return false;
    }
    const amount = Number(adjAmount) || 0;
    if (amount <= 0) {
      toast.error("Nominal jurnal penyesuaian wajib diisi");
      return false;
    }
    if (!adjDate) {
      toast.error("Tanggal jurnal wajib diisi");
      return false;
    }
    setAdjSubmitting(true);
    try {
      await journalApi.createAdjustingEntry({
        entry_date: adjDate,
        description: adjDescription || adjSelectedTemplate.label,
        template_id: adjSelectedTemplate.id,
        created_by: user?.name || "Admin",
        lines: adjSelectedTemplate.lines.map((l) => ({
          account_code: l.account_code,
          debit: l.side === "debit" ? amount : 0,
          credit: l.side === "credit" ? amount : 0,
          description: l.description,
        })),
      });
      toast.success("Jurnal penyesuaian berhasil diposting");
      setAdjAmount("");
      setAdjDescription("");
      setAdjTemplateId("");
      queryClient.invalidateQueries({ queryKey: ["journal", "entries"] });
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setAdjSubmitting(false);
    }
  }

  // ─── Buku Besar ────────────────────────────────────────────────────────
  const [ledgerAccountCode, setLedgerAccountCode] = useState("");
  const [ledgerStartDate, setLedgerStartDate] = useState("");
  const [ledgerEndDate, setLedgerEndDate] = useState(today());
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  async function loadLedger() {
    if (!ledgerAccountCode) {
      toast.error("Pilih akun terlebih dahulu");
      return;
    }
    setLedgerLoading(true);
    try {
      const res = await journalApi.getLedger({
        account_code: ledgerAccountCode,
        start_date: ledgerStartDate || undefined,
        end_date: ledgerEndDate || undefined,
      });
      setLedger(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLedgerLoading(false);
    }
  }

  // ─── Neraca Saldo (Awal) — SEBELUM jurnal penyesuaian ──────────────────
  const [trialBalanceDate, setTrialBalanceDate] = useState(today());
  const trialBalanceQuery = useQuery({
    queryKey: ["journal", "trial-balance", trialBalanceDate],
    queryFn: () =>
      journalApi.getTrialBalance({
        as_of_date: trialBalanceDate || undefined,
        exclude_adjustments: "true",
      }),
    enabled: tab === "neraca-saldo",
  });

  // ─── Neraca Saldo Disesuaikan — SETELAH jurnal penyesuaian ─────────────
  const [adjustedTrialBalanceDate, setAdjustedTrialBalanceDate] =
    useState(today());
  const adjustedTrialBalanceQuery = useQuery({
    queryKey: ["journal", "trial-balance-adjusted", adjustedTrialBalanceDate],
    queryFn: () =>
      journalApi.getTrialBalance({
        as_of_date: adjustedTrialBalanceDate || undefined,
      }),
    enabled: tab === "neraca-saldo-disesuaikan",
  });

  // ─── Neraca (Balance Sheet) ─────────────────────────────────────────────
  const [balanceSheetDate, setBalanceSheetDate] = useState(today());
  const balanceSheetQuery = useQuery({
    queryKey: ["journal", "balance-sheet", balanceSheetDate],
    queryFn: () =>
      journalApi.getBalanceSheet({
        as_of_date: balanceSheetDate || undefined,
      }),
    enabled: tab === "neraca",
  });

  // ─── Laporan Arus Kas ──────────────────────────────────────────────────
  const [cashFlowStartDate, setCashFlowStartDate] = useState(firstDayOfMonth());
  const [cashFlowEndDate, setCashFlowEndDate] = useState(today());
  const cashFlowQuery = useQuery({
    queryKey: ["journal", "cash-flow", { cashFlowStartDate, cashFlowEndDate }],
    queryFn: () =>
      journalApi.getCashFlow({
        start_date: cashFlowStartDate || undefined,
        end_date: cashFlowEndDate || undefined,
      }),
    enabled: tab === "arus-kas",
    // Laporan ini sensitif terhadap perubahan dari modul lain (pinjaman,
    // pembelian, penjualan, dll) yang tidak meng-invalidate query key ini.
    // staleTime 0 (override default 15s global) memastikan setiap kali tab
    // "Arus Kas" dibuka, data SELALU diambil ulang dari server — bukan dari
    // cache — supaya konsisten dengan angka aktual di database saat itu.
    staleTime: 0,
  });

  return {
    tab,
    setTab,

    accounts: accountsQuery.data?.data ?? [],
    accountsLoading: accountsQuery.isLoading,
    createAccount,
    reloadAccounts: accountsQuery.refetch,

    entries: entriesQuery.data?.data ?? [],
    entriesTotal: entriesQuery.data?.total ?? 0,
    entriesPage,
    setEntriesPage,
    entriesLoading: entriesQuery.isLoading,
    referenceTypeFilter,
    setReferenceTypeFilter,
    selectedEntry,
    setSelectedEntry,
    viewEntryDetail,
    deleteEntry,
    reverseEntry,

    manualDate,
    setManualDate,
    manualDescription,
    setManualDescription,
    manualLines,
    addManualLine,
    updateManualLine,
    removeManualLine,
    manualTotalDebit,
    manualTotalCredit,
    manualIsBalanced,
    manualSubmitting,
    submitManualEntry,

    adjTemplates,
    adjTemplatesLoading: templatesQuery.isLoading,
    adjTemplateId,
    selectAdjTemplate,
    adjSelectedTemplate,
    adjDate,
    setAdjDate,
    adjDescription,
    setAdjDescription,
    adjAmount,
    setAdjAmount,
    adjSubmitting,
    submitAdjustingEntry,

    ledgerAccountCode,
    setLedgerAccountCode,
    ledgerStartDate,
    setLedgerStartDate,
    ledgerEndDate,
    setLedgerEndDate,
    ledger,
    ledgerLoading,
    loadLedger,

    trialBalanceDate,
    setTrialBalanceDate,
    trialBalance: trialBalanceQuery.data?.data ?? null,
    trialBalanceLoading: trialBalanceQuery.isLoading,

    adjustedTrialBalanceDate,
    setAdjustedTrialBalanceDate,
    adjustedTrialBalance: adjustedTrialBalanceQuery.data?.data ?? null,
    adjustedTrialBalanceLoading: adjustedTrialBalanceQuery.isLoading,

    balanceSheetDate,
    setBalanceSheetDate,
    balanceSheet: balanceSheetQuery.data?.data ?? null,
    balanceSheetLoading: balanceSheetQuery.isLoading,

    cashFlowStartDate,
    setCashFlowStartDate,
    cashFlowEndDate,
    setCashFlowEndDate,
    cashFlow: cashFlowQuery.data?.data ?? null,
    cashFlowLoading: cashFlowQuery.isLoading,
  };
}
