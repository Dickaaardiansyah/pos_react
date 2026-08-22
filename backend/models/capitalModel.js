// models/capitalModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — modul Modal Usaha: riwayat setoran modal (termasuk Modal Awal)
// dan penarikan modal (prive) oleh pemilik. Query mentah saja; aturan bisnis
// (validasi Modal Awal hanya boleh satu, posting jurnal otomatis) hidup di
// services/capitalService.js.
// ─────────────────────────────────────────────────────────────────────────────
const {
  query,
  queryOne,
  insert,
  transaction,
  safeInt,
} = require("../config/database");
const journalService = require("../services/journalService");
const { lockOpenShift } = require("./shiftLockHelper");

const capitalModel = {
  // Catat transaksi modal + posting jurnal (Dr/Cr Kas vs Modal Pemilik/Prive)
  // dalam satu DB transaction — kalau jurnal gagal, insert transaksi modal
  // ini ikut rollback (tidak lagi best-effort).
  create({
    transactionCode,
    transactionDate,
    type,
    isInitial,
    targetAccount,
    amount,
    description,
    recordedBy,
    shiftId, 
    shiftUserId, 
  }) {
    return transaction(async (conn) => {
      const resolvedTargetAccount = targetAccount || "kas";
      const resolvedShiftId =
        resolvedTargetAccount === "kas" ? shiftId || null : null;

      await lockOpenShift(conn, resolvedShiftId, shiftUserId);

      const [result] = await conn.execute(
        `INSERT INTO capital_transactions
           (transaction_code, transaction_date, type, is_initial, target_account, shift_id, amount, description, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionCode,
          transactionDate,
          type,
          isInitial ? 1 : 0,
          resolvedTargetAccount,
          resolvedShiftId,
          amount,
          description || "",
          recordedBy || "",
        ],
      );
      const [rows] = await conn.execute(
        "SELECT * FROM capital_transactions WHERE id = ?",
        [result.insertId],
      );
      const tx = rows[0];
      await journalService.postCapitalJournal(tx, conn);
      return tx;
    });
  },

  findById(id) {
    return queryOne("SELECT * FROM capital_transactions WHERE id = ?", [id]);
  },

  // Modal Awal usaha — hanya boleh ada satu baris dengan is_initial = 1.
  findInitial() {
    return queryOne(
      "SELECT * FROM capital_transactions WHERE is_initial = 1 LIMIT 1",
    );
  },

  findAll({ type, startDate, endDate, search, limit = 20, offset = 0 } = {}) {
    const params = [];
    let where = "WHERE 1=1";
    if (type) {
      where += " AND type = ?";
      params.push(type);
    }
    if (startDate) {
      where += " AND transaction_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND transaction_date <= ?";
      params.push(endDate);
    }
    if (search) {
      where += " AND (description LIKE ? OR transaction_code LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    return Promise.all([
      queryOne(
        `SELECT COUNT(*) AS total FROM capital_transactions ${where}`,
        params,
      ),
      query(
        `SELECT * FROM capital_transactions ${where}
         ORDER BY is_initial DESC, transaction_date DESC, id DESC
         LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([totalRow, rows]) => ({
      total: Number(totalRow?.total || 0),
      rows,
    }));
  },

  // Total setoran & penarikan sepanjang waktu — dasar ringkasan Modal Usaha.
  sumTotals() {
    return queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'setoran' THEN amount ELSE 0 END), 0) AS total_setoran,
         COALESCE(SUM(CASE WHEN type = 'setoran' AND is_initial = 0 THEN amount ELSE 0 END), 0) AS total_setoran_tambahan,
         COALESCE(SUM(CASE WHEN type = 'penarikan' THEN amount ELSE 0 END), 0) AS total_penarikan
       FROM capital_transactions`,
    );
  },

  // Total setoran & penarikan HANYA dalam satu periode (transaction_date
  // BETWEEN startDate..endDate) — dasar baris "Setoran"/"Prive" pada
  // Laporan Perubahan Modal (lihat capitalService.equityStatement).
  sumTotalsInPeriod(startDate, endDate) {
    return queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'setoran' THEN amount ELSE 0 END), 0) AS total_setoran,
         COALESCE(SUM(CASE WHEN type = 'penarikan' THEN amount ELSE 0 END), 0) AS total_penarikan
       FROM capital_transactions
       WHERE transaction_date BETWEEN ? AND ?`,
      [startDate, endDate],
    );
  },
};

module.exports = capitalModel;
