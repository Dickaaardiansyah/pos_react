// backend/services/webPushService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — kirim notifikasi ke browser lewat Web Push (Service Worker),
// dipanggil dari notificationService setiap kali notifikasi BARU dibuat
// (bukan setiap upsert, supaya tidak spam push untuk kondisi yang sama
// berkali-kali — lihat notificationService.upsertNotification).
//
// Kalau VAPID key belum di-set di .env, service ini tidak melempar error —
// cukup skip pengiriman push (fitur lain tetap jalan normal, notifikasi
// tetap tercatat & tampil di panel lonceng seperti biasa).
// ─────────────────────────────────────────────────────────────────────────────
const webpush = require("web-push");
const pushSubscriptionModel = require("../models/pushSubscriptionModel");

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
const isConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (isConfigured) {
  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:admin@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
} else {
  console.warn(
    "⚠️  VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY belum diatur di .env — notifikasi push dinonaktifkan (jalankan `node scripts/generate-vapid-keys.js`).",
  );
}

// Halaman tujuan saat notifikasi di klik — sama seperti logic di
// NotificationBell.jsx (reorder_point → halaman rekomendasi restock,
// selain itu → halaman produk).
function urlForType(type) {
  return type === "reorder_point" ? "/reorder-point" : "/produk";
}

const TYPE_LABEL = {
  stock_out: "Stok Habis",
  low_stock: "Stok Menipis",
  reorder_point: "Reorder Point",
};

const webPushService = {
  isConfigured,

  publicKey() {
    return VAPID_PUBLIC_KEY || null;
  },

  saveSubscription({ userId, subscription }) {
    const { endpoint, keys } = subscription || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      const err = new Error("Data subscription push tidak lengkap");
      err.status = 400;
      throw err;
    }
    return pushSubscriptionModel.upsert({
      userId: userId || null,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
  },

  removeSubscription(endpoint) {
    if (!endpoint) return Promise.resolve();
    return pushSubscriptionModel.deleteByEndpoint(endpoint);
  },

  // Dipanggil notificationService setiap ada notifikasi BARU (stok habis/
  // menipis/reorder point). Fire-and-forget dari sisi caller — kegagalan di
  // sini tidak boleh menggagalkan pembuatan notifikasi itu sendiri.
  async notifyNewNotification({ type, level, message }) {
    if (!isConfigured) return;

    const subscriptions = await pushSubscriptionModel.findAll();
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title:
        level === "critical"
          ? "🔴 " + (TYPE_LABEL[type] || "Notifikasi")
          : "🟠 " + (TYPE_LABEL[type] || "Notifikasi"),
      body: message,
      tag: `notif-${type}`,
      url: urlForType(type),
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        try {
          await webpush.sendNotification(pushSubscription, payload);
        } catch (err) {
          // 404/410 = subscription sudah tidak valid (browser di-uninstall,
          // izin dicabut, dst.) — bersihkan dari database supaya tidak
          // terus dicoba tiap kali ada notifikasi baru.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await pushSubscriptionModel
              .deleteByEndpoint(sub.endpoint)
              .catch(() => {});
          } else {
            console.error("Gagal kirim push notification:", err.message);
          }
        }
      }),
    );
  },
};

module.exports = { webPushService };
