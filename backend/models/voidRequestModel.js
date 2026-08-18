// models/voidRequestModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — pengajuan & persetujuan void transaksi (void_requests).
// Lihat database/void_approval.sql untuk skema dan alasan lengkapnya.
// ─────────────────────────────────────────────────────────────────────────────
const { query, queryOne, insert, execute } = require("../config/database");

const voidRequestModel = {
  findById(id) {
    return queryOne("SELECT * FROM void_requests WHERE id = ?", [id]);
  },

  // Satu transaksi hanya boleh punya SATU pengajuan yang masih 'pending'
  // di satu waktu — dicek sebelum insert baru untuk mencegah duplikasi.
  findPendingByTransaction(transactionId) {
    return queryOne(
      "SELECT * FROM void_requests WHERE transaction_id = ? AND status = 'pending'",
      [transactionId],
    );
  },

  create({ transactionId, requestedByUserId, requestedByName, reason }) {
    return insert(
      `INSERT INTO void_requests
         (transaction_id, requested_by_user_id, requested_by_name, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [transactionId, requestedByUserId, requestedByName, reason],
    );
  },

  // UPDATE ber-syarat "AND status='pending'" — ini yang membuat approve/reject
  // aman dari race condition (dua admin klik approve & reject hampir
  // bersamaan pada pengajuan yang sama): siapa pun yang baris ter-update
  // duluan "menang" (affectedRows=1), yang kedua dapat affectedRows=0 dan
  // tahu pengajuan sudah diproses pihak lain.
  claimApproved(id, { reviewedByUserId, reviewedByName, note }) {
    return execute(
      `UPDATE void_requests
         SET status = 'approved', reviewed_by_user_id = ?, reviewed_by_name = ?,
             review_note = ?, reviewed_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [reviewedByUserId, reviewedByName, note || null, id],
    );
  },

  claimRejected(id, { reviewedByUserId, reviewedByName, note }) {
    return execute(
      `UPDATE void_requests
         SET status = 'rejected', reviewed_by_user_id = ?, reviewed_by_name = ?,
             review_note = ?, reviewed_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [reviewedByUserId, reviewedByName, note, id],
    );
  },

  // Dipakai untuk membatalkan klaim 'approved' kalau eksekusi void ternyata
  // gagal setelah diklaim (lihat voidRequestService.approve) — supaya
  // pengajuan tidak macet berstatus 'approved' padahal transaksinya belum
  // benar-benar dibatalkan.
  resetToPending(id) {
    return execute(
      `UPDATE void_requests
         SET status = 'pending', reviewed_by_user_id = NULL, reviewed_by_name = NULL,
             review_note = NULL, reviewed_at = NULL
       WHERE id = ?`,
      [id],
    );
  },

  listAll({ status } = {}) {
    let sql = `
      SELECT vr.*, t.transaction_code, t.final_amount,
             t.created_at AS transaction_created_at,
             t.cashier_name AS transaction_cashier_name
      FROM void_requests vr
      JOIN transactions t ON t.id = vr.transaction_id`;
    const params = [];
    if (status) {
      sql += " WHERE vr.status = ?";
      params.push(status);
    }
    sql += " ORDER BY vr.requested_at DESC";
    return query(sql, params);
  },

  listByRequester(userId, { status } = {}) {
    let sql = `
      SELECT vr.*, t.transaction_code, t.final_amount,
             t.created_at AS transaction_created_at
      FROM void_requests vr
      JOIN transactions t ON t.id = vr.transaction_id
      WHERE vr.requested_by_user_id = ?`;
    const params = [userId];
    if (status) {
      sql += " AND vr.status = ?";
      params.push(status);
    }
    sql += " ORDER BY vr.requested_at DESC";
    return query(sql, params);
  },
};

module.exports = voidRequestModel;
