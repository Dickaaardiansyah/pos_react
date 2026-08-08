// backend/models/pushSubscriptionModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — akses data untuk "langganan" Web Push (satu baris = satu
// browser/perangkat yang sudah mengizinkan notifikasi). Tidak ada logika
// bisnis di sini, murni akses data — pengiriman push ada di webPushService.
// ─────────────────────────────────────────────────────────────────────────────
const { query, insert, execute } = require("../config/database");

const pushSubscriptionModel = {
  findAll() {
    return query("SELECT * FROM push_subscriptions");
  },

  // Subscribe ulang dari perangkat yang sama (endpoint identik) harus
  // meng-update baris lama, bukan membuat duplikat — kunci (p256dh/auth)
  // browser kadang berubah walau endpoint sama setelah tertentu, jadi tetap
  // di-refresh nilainya.
  upsert({ userId, endpoint, p256dh, auth }) {
    return insert(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
      [userId, endpoint, p256dh, auth],
    );
  },

  deleteByEndpoint(endpoint) {
    return execute("DELETE FROM push_subscriptions WHERE endpoint = ?", [
      endpoint,
    ]);
  },
};

module.exports = pushSubscriptionModel;
