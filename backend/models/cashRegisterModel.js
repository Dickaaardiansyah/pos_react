// models/cashRegisterModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — modul Kas Kecil: sesi kas (cash_shifts) dan pergerakan kas
// insidental (cash_movements). Query mentah saja; aturan bisnis (validasi,
// perhitungan selisih, dsb.) hidup di services/cashRegisterService.js.
// ─────────────────────────────────────────────────────────────────────────────
const {
  query,
  queryOne,
  insert,
  execute,
  transaction,
  safeInt,
} = require("../config/database");
const journalService = require("../services/journalService");

const cashRegisterModel = {
  // ─── Sesi kas (shift) ───────────────────────────────────────────────────
  findActiveShift() {
    return queryOne(
      "SELECT * FROM cash_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1",
    );
  },

  findShiftById(id) {
    return queryOne("SELECT * FROM cash_shifts WHERE id = ?", [id]);
  },

  createShift({
    shiftCode,
    openingBalance,
    openingNotes,
    openedBy,
    occurredAt,
  }) {
    return insert(
      `INSERT INTO cash_shifts
         (shift_code, opening_balance, opening_notes, opened_by, opened_at, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [
        shiftCode,
        openingBalance,
        openingNotes || "",
        openedBy || "Admin",
        occurredAt,
      ],
    );
  },

  // Tutup sesi kas + posting jurnal penyesuaian selisih (jika ada) dalam
  // satu DB transaction — kalau jurnal gagal, penutupan sesi ikut rollback
  // (tidak ada lagi sesi "tertutup" tanpa jurnal selisihnya tercatat).
  closeShift(
    id,
    {
      closingBalanceSystem,
      closingBalancePhysical,
      difference,
      totalCashSales,
      totalCashIn,
      totalCashOut,
      closingNotes,
      closedBy,
      occurredAt,
    },
  ) {
    return transaction(async (conn) => {
      await conn.execute(
        `UPDATE cash_shifts SET
           closing_balance_system = ?, closing_balance_physical = ?, difference = ?,
           total_cash_sales = ?, total_cash_in = ?, total_cash_out = ?,
           closing_notes = ?, closed_by = ?, closed_at = ?, status = 'closed'
         WHERE id = ?`,
        [
          closingBalanceSystem,
          closingBalancePhysical,
          difference,
          totalCashSales,
          totalCashIn,
          totalCashOut,
          closingNotes || "",
          closedBy || "Admin",
          occurredAt,
          id,
        ],
      );

      const [rows] = await conn.execute(
        "SELECT * FROM cash_shifts WHERE id = ?",
        [id],
      );
      const closed = rows[0];
      await journalService.postCashShiftCloseJournal(closed, conn);
      return closed;
    });
  },

  findShiftHistory({ startDate, endDate, limit = 20, offset = 0 } = {}) {
    const params = [];
    let where = "WHERE status = 'closed'";
    if (startDate) {
      where += " AND DATE(opened_at) >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND DATE(opened_at) <= ?";
      params.push(endDate);
    }

    return Promise.all([
      queryOne(`SELECT COUNT(*) AS total FROM cash_shifts ${where}`, params),
      query(
        `SELECT * FROM cash_shifts ${where} ORDER BY opened_at DESC, id DESC LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([totalRow, rows]) => ({
      total: Number(totalRow?.total || 0),
      rows,
    }));
  },

  // ─── Pergerakan kas (cash in / cash out) ────────────────────────────────
  findMovementsByShift(shiftId) {
    return query(
      "SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY created_at DESC, id DESC",
      [shiftId],
    );
  },

  findMovementById(id) {
    return queryOne("SELECT * FROM cash_movements WHERE id = ?", [id]);
  },

  // Catat pergerakan kas + posting jurnal (Dr/Cr Kas vs Beban/Modal/
  // Pendapatan Lain-lain) dalam satu DB transaction — kalau jurnal gagal,
  // insert pergerakan kas ini ikut rollback.
  createMovement({
    shiftId,
    shiftCode,
    type,
    category,
    amount,
    description,
    createdBy,
    occurredAt,
  }) {
    return transaction(async (conn) => {
      const [result] = await conn.execute(
        `INSERT INTO cash_movements
           (shift_id, type, category, amount, description, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          shiftId,
          type,
          category,
          amount,
          description || "",
          createdBy || "Admin",
          occurredAt,
        ],
      );
      const [rows] = await conn.execute(
        "SELECT * FROM cash_movements WHERE id = ?",
        [result.insertId],
      );
      const movement = rows[0];
      await journalService.postCashMovementJournal(movement, shiftCode, conn);
      return movement;
    });
  },

  deleteMovement(id) {
    return execute("DELETE FROM cash_movements WHERE id = ?", [id]);
  },

  sumMovements(shiftId) {
    return query(
      `SELECT type, COALESCE(SUM(amount),0) AS total
       FROM cash_movements WHERE shift_id = ? GROUP BY type`,
      [shiftId],
    );
  },

  // Total kas masuk dari penjualan selama rentang shift berjalan/berakhir —
  // dasar perhitungan "saldo kas seharusnya" saat tutup kas.
  // Mencakup 2 sumber yang sama-sama di-debit ke akun Kas (1100) oleh
  // journalService.postSaleJournal():
  //   1) Transaksi tunai penuh (payment_method = 'cash')  → final_amount
  //   2) DP tunai transaksi Open Bill (payment_method = 'open_bill') →
  //      payment_amount (bisa Rp0 kalau Open Bill tanpa DP)
  // PENTING: transaksi non-tunai lain yang JUGA menyentuh akun Kas di jurnal
  // (pembayaran piutang/utang tunai, pembelian tunai, setoran/prive modal
  // tunai, beban operasional) SENGAJA tidak dihitung di sini — modul Kas
  // Kecil ini merepresentasikan laci kasir harian, bukan saldo akun Kas (COA
  // 1100) secara keseluruhan. Kalau di praktiknya transaksi-transaksi itu
  // juga dibayar/diterima dari laci yang sama, saldo di sini akan selisih
  // dari saldo akun Kas di Neraca Saldo — itu ekspektasi yang benar, bukan
  // bug, selama pemakaiannya konsisten.
  sumCashSales(openedAt, closedAt) {
    const cashOrOpenBillDp = `
      COALESCE(SUM(
        CASE
          WHEN payment_method = 'cash' THEN final_amount
          WHEN payment_method = 'open_bill' THEN payment_amount
          ELSE 0
        END
      ), 0) AS total_cash_sales
      FROM transactions
      WHERE status = 'completed'
        AND (payment_method = 'cash' OR (payment_method = 'open_bill' AND payment_amount > 0))`;
    if (closedAt) {
      return queryOne(
        `SELECT ${cashOrOpenBillDp}
           AND created_at BETWEEN ? AND ?`,
        [openedAt, closedAt],
      );
    }
    return queryOne(
      `SELECT ${cashOrOpenBillDp}
         AND created_at >= ?`,
      [openedAt],
    );
  },
};

module.exports = cashRegisterModel;
