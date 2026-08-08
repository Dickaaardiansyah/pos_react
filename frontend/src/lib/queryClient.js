// src/lib/queryClient.js
// ─────────────────────────────────────────────────────────────────────────────
// Konfigurasi TanStack Query — pengganti pola manual
// (useState + useEffect + loading + try/catch) yang dulu diulang di setiap
// presenter. Semua fetch data server sekarang lewat useQuery/useMutation,
// dengan cache, retry, dan revalidation ditangani library, bukan ditulis
// manual per fitur.
// ─────────────────────────────────────────────────────────────────────────────
import { QueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000, // data dianggap "segar" 15 detik — cukup untuk POS tanpa spam request
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err) => {
        toast.error(err?.message || "Terjadi kesalahan");
      },
    },
  },
});

// Query keys terpusat supaya invalidateQueries antar-fitur (mis. transaksi
// checkout perlu invalidate dashboard & produk) tidak salah ketik.
export const queryKeys = {
  customers: (params) => ["customers", params],
  customer: (id) => ["customers", id],
  products: (params) => ["products", params],
  categories: () => ["categories"],
  units: () => ["units"],
  reorderPoints: (days) => ["products", "reorder-point", days],
  transactions: (params) => ["transactions", params],
  transaction: (id) => ["transactions", id],
  dashboardSummary: () => ["dashboard", "summary"],
  dashboardPeriod: (range) => ["dashboard", "period", range],
  incomeStatement: (range) => ["accounting", "income-statement", range],
  suppliers: () => ["suppliers"],
  purchases: (params) => ["purchases", params],
  payables: (params) => ["payables", params],
  receivables: (params) => ["receivables", params],
  cashRegisterHistory: (params) => ["cash-register", "history", params],
  cashRegisterCategories: () => ["cash-register", "categories"],
  stockMutations: (params) => ["stock-mutations", params],
  stockOpnames: (params) => ["stock-opname", params],
  journalAccounts: (params) => ["journal", "accounts", params],
  journalEntries: (params) => ["journal", "entries", params],
  notifications: (params) => ["notifications", params],
  notificationUnreadCount: () => ["notifications", "unread-count"],
  settings: () => ["settings"],
  users: () => ["users"],
  reports: (type, params) => ["reports", type, params],
};
