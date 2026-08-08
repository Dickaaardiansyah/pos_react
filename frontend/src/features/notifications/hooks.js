// frontend/src/features/notifications/hooks.js
// Bel notifikasi (stok habis / menipis / reorder point). Polling jumlah
// belum dibaca via useQuery's refetchInterval (bawaan react-query, tidak
// perlu setInterval manual lagi); riwayat lengkap baru diambil saat panel
// dibuka (enabled: open).
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "./api";
import {
  isPushSupported,
  registerServiceWorker,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  hasAutoPrompted,
  markAutoPrompted,
} from "./push";
import { useAuth } from "../../context/AuthContext";
import { queryKeys } from "../../lib/queryClient";

const POLL_INTERVAL_MS = 60000;

export function useNotifications() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const queryClient = useQueryClient();

  // Daftarkan Service Worker & aktifkan push OTOMATIS begitu admin login —
  // tidak perlu lagi klik "Aktifkan push" di lonceng secara manual.
  //   - Kalau izin browser sudah "granted" tapi subscription-nya hilang
  //     (mis. abis reset database/localStorage), subscribe ulang diam-diam
  //     tanpa prompt apa pun (browser tidak akan menampilkan apa-apa).
  //   - Kalau izin masih "default" (belum pernah ditanya), tampilkan prompt
  //     browser SEKALI saja per perangkat (ditandai lewat localStorage) —
  //     supaya kalau user menutup/menolak prompt-nya, aplikasi tidak terus
  //     memaksa nanya ulang di setiap reload (dianggap spam oleh browser).
  //     User tetap bisa coba lagi manual lewat tombol di panel lonceng.
  //   - Kalau izin "denied", tidak dicoba otomatis — browser modern tidak
  //     mengizinkan re-prompt lewat JS, harus diaktifkan lewat setelan situs.
  useEffect(() => {
    if (!isAdmin || !isPushSupported()) return;
    registerServiceWorker().catch(() => {});

    getPushSubscription()
      .then((sub) => {
        if (sub) {
          setPushEnabled(true);
          return;
        }

        const permission = Notification.permission;
        if (permission === "denied") return;
        if (permission === "default" && hasAutoPrompted()) return;
        if (permission === "default") markAutoPrompted();

        subscribeToPush()
          .then(() => setPushEnabled(true))
          .catch(() => {
            // Gagal/ditolak — biarkan senyap, badge tetap "nonaktif" dan
            // user bisa coba lagi lewat tombol manual di panel lonceng.
          });
      })
      .catch(() => {});
  }, [isAdmin]);

  const togglePush = useCallback(async () => {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
      } else {
        await subscribeToPush();
        setPushEnabled(true);
      }
    } finally {
      setPushBusy(false);
    }
  }, [pushEnabled]);

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
      old
        ? {
            ...old,
            data: old.data.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)),
          }
        : old,
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
    pushSupported: isPushSupported(),
    pushEnabled,
    pushBusy,
    togglePush,
  };
}
