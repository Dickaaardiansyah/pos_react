// models/notificationModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — satu-satunya lapisan yang boleh menyentuh SQL untuk domain
// "notifikasi" (stok habis / stok menipis / reorder point). Tidak ada logika
// bisnis di sini (kapan notifikasi harus dibuat/diselesaikan), murni akses data
// — logika itu ada di notificationService.
// ─────────────────────────────────────────────────────────────────────────────
const { query, queryOne, insert, execute, safeInt } = require("../config/database");

const notificationModel = {
  // Riwayat notifikasi, terbaru dulu. onlyUnread untuk badge/dropdown ringkas.
  findAll({ onlyUnread, limit = 50, offset = 0 } = {}) {
    let sql = "SELECT * FROM notifications";
    const params = [];
    if (onlyUnread) sql += " WHERE is_read = 0";
    sql += ` ORDER BY created_at DESC LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`;
    return query(sql, params);
  },

  countUnread() {
    return queryOne(
      "SELECT COUNT(*) AS total FROM notifications WHERE is_read = 0",
    );
  },

  // Notifikasi jenis tertentu untuk suatu produk yang MASIH AKTIF (belum
  // resolved) — dipakai checkAndGenerate() supaya tidak membuat notifikasi
  // duplikat berkali-kali selama kondisinya belum berubah.
  findActiveByProductAndType(productId, type) {
    return queryOne(
      `SELECT * FROM notifications
       WHERE product_id = ? AND type = ? AND is_resolved = 0
       ORDER BY created_at DESC LIMIT 1`,
      [productId, type],
    );
  },

  create({ type, level, productId, productName, message }) {
    return insert(
      `INSERT INTO notifications (type, level, product_id, product_name, message)
       VALUES (?, ?, ?, ?, ?)`,
      [type, level, productId, productName, message],
    );
  },

  // Kondisi sudah membaik (mis. sudah direstock) — jangan dihapus, cukup
  // ditandai selesai supaya tetap tercatat di riwayat.
  resolve(id) {
    return execute(
      "UPDATE notifications SET is_resolved = 1, resolved_at = NOW() WHERE id = ? AND is_resolved = 0",
      [id],
    );
  },

  markRead(id) {
    return execute("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
  },

  markAllRead() {
    return execute(
      "UPDATE notifications SET is_read = 1 WHERE is_read = 0",
    );
  },
};

module.exports = notificationModel;
