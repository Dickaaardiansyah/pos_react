// frontend/src/components/NotificationBell.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIEW LAYER — ikon lonceng notifikasi (stok habis / stok menipis / reorder
// point), tampil global di semua halaman admin. Klik ikon → buka panel
// riwayat notifikasi (30 terbaru, gabungan aktif & yang sudah selesai).
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useEffect } from "react";
import { Bell, BellRing, BellOff, PackageX, AlertTriangle, PackageSearch, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useNotifications } from "../features/notifications/hooks";
import { formatDateTime } from "../utils/format";

// Tiap jenis notifikasi punya ikon & warna sendiri supaya sekilas pandang
// langsung kelihatan mana yang paling darurat (stok habis = merah).
const TYPE_META = {
  stock_out: { icon: PackageX, className: "notif-icon--critical", label: "Stok Habis" },
  low_stock: { icon: AlertTriangle, className: "notif-icon--warning", label: "Stok Menipis" },
  reorder_point: { icon: PackageSearch, className: "notif-icon--info", label: "Reorder Point" },
};

function NotificationItem({ notif, onRead, onNavigate }) {
  const meta = TYPE_META[notif.type] || TYPE_META.low_stock;
  const Icon = meta.icon;

  return (
    <button
      type="button"
      className={`notif-item ${notif.is_read ? "" : "notif-item--unread"}`}
      onClick={() => {
        if (!notif.is_read) onRead(notif.id);
        onNavigate();
      }}
    >
      <span className={`notif-icon ${meta.className}`}>
        <Icon size={16} />
      </span>
      <span className="notif-item__body">
        <span className="notif-item__message">{notif.message}</span>
        <span className="notif-item__meta">
          {meta.label} · {formatDateTime(notif.created_at)}
          {notif.is_resolved ? " · sudah teratasi" : ""}
        </span>
      </span>
      {!notif.is_read && <span className="notif-item__dot" />}
    </button>
  );
}

export default function NotificationBell() {
  const n = useNotifications();
  const navigate = useNavigate();
  const wrapperRef = useRef(null);

  // Tutup panel kalau klik di luar area bel/dropdown.
  useEffect(() => {
    if (!n.open) return;
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        n.closePanel();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [n.open, n.closePanel]);

  async function handleTogglePush() {
    try {
      await n.togglePush();
      toast.success(n.pushEnabled ? "Notifikasi push dinonaktifkan" : "Notifikasi push diaktifkan");
    } catch (err) {
      toast.error(err.message || "Gagal mengubah pengaturan notifikasi push");
    }
  }

  if (!n.isAdmin) return null;

  return (
    <div className="notif-bell-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={n.toggleOpen}
        aria-label="Notifikasi"
        title="Notifikasi"
      >
        <Bell size={19} />
        {n.unreadCount > 0 && (
          <span className="notif-bell-badge">
            {n.unreadCount > 99 ? "99+" : n.unreadCount}
          </span>
        )}
      </button>

      {n.open && (
        <div className="notif-panel">
          <div className="notif-panel__header">
            <span className="notif-panel__title">Notifikasi</span>
            <div className="notif-panel__header-actions">
              {n.pushSupported && (
                <button
                  type="button"
                  className={`notif-panel__push-toggle ${n.pushEnabled ? "notif-panel__push-toggle--active" : ""}`}
                  onClick={handleTogglePush}
                  disabled={n.pushBusy}
                  title={n.pushEnabled ? "Matikan notifikasi push" : "Aktifkan notifikasi push"}
                >
                  {n.pushEnabled ? <BellRing size={13} /> : <BellOff size={13} />}
                  {n.pushEnabled ? "Push aktif" : "Aktifkan push"}
                </button>
              )}
              {n.unreadCount > 0 && (
                <button type="button" className="notif-panel__mark-all" onClick={n.markAllRead}>
                  <CheckCheck size={13} /> Tandai semua dibaca
                </button>
              )}
            </div>
          </div>

          <div className="notif-panel__list">
            {n.loading ? (
              <div className="notif-panel__empty">Memuat...</div>
            ) : n.items.length === 0 ? (
              <div className="notif-panel__empty">Belum ada notifikasi. Semua stok aman 👍</div>
            ) : (
              n.items.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notif={notif}
                  onRead={n.markRead}
                  onNavigate={() => {
                    n.closePanel();
                    navigate(
                      notif.type === "reorder_point" ? "/reorder-point" : "/produk",
                    );
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}