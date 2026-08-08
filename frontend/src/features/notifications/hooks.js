// src/features/notifications/hooks.js
// Bel notifikasi (stok habis / menipis / reorder point). Polling jumlah
// belum dibaca via useQuery's refetchInterval (bawaan react-query, tidak
// perlu setInterval manual lagi); riwayat lengkap baru diambil saat panel
// dibuka (enabled: open).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "./api";
import { useAuth } from "../../context/AuthContext";
import { queryKeys } from "../../lib/queryClient";

const POLL_INTERVAL_MS = 60000;

export function useNotifications() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: queryKeys.notificationUnreadCount(),
    queryFn: () => notificationsApi.unreadCount(),
    enabled: isAdmin,
    refetchInterval: POLL_INTERVAL_MS,
    // Badge notifikasi bukan fitur kritikal — gagal diam-diam, jangan
    // ganggu pengguna dengan toast error tiap 60 detik.
    throwOnError: false,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.notifications({ limit: 30 }),
    queryFn: () => notificationsApi.list({ limit: 30 }),
    enabled: isAdmin && open,
    throwOnError: false,
  });

  function toggleOpen() {
    setOpen((v) => !v);
  }
  function closePanel() {
    setOpen(false);
  }

  async function markRead(id) {
    // Optimistic update lokal — polling berikutnya (maks 60 detik) akan
    // mengoreksi balik kalau request gagal, tanpa perlu rollback manual.
    queryClient.setQueryData(queryKeys.notifications({ limit: 30 }), (old) =>
      old ? { ...old, data: old.data.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)) } : old,
    );
    queryClient.setQueryData(queryKeys.notificationUnreadCount(), (old) =>
      old ? { ...old, data: { count: Math.max(0, old.data.count - 1) } } : old,
    );
    try {
      await notificationsApi.markRead(id);
    } catch {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }

  async function markAllRead() {
    queryClient.setQueryData(queryKeys.notifications({ limit: 30 }), (old) =>
      old ? { ...old, data: old.data.map((n) => ({ ...n, is_read: 1 })) } : old,
    );
    queryClient.setQueryData(queryKeys.notificationUnreadCount(), (old) =>
      old ? { ...old, data: { count: 0 } } : old,
    );
    try {
      await notificationsApi.markAllRead();
    } catch {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }

  return {
    isAdmin,
    unreadCount: unreadQuery.data?.data?.count ?? 0,
    items: historyQuery.data?.data ?? [],
    loading: historyQuery.isLoading,
    open,
    toggleOpen,
    closePanel,
    markRead,
    markAllRead,
  };
}
