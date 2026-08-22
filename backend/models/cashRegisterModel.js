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
const {
  ValidationError,
  NotFoundError,
} = require("../services/productService");
const { lockOpenShift } = require("./shiftLockHelper");

const cashRegisterModel = {
  getDefaultRegister() {
    return queryOne(
      "SELECT * FROM cash_registers WHERE is_active = 1 ORDER BY id ASC LIMIT 1",
    );
  },

  findAllRegisters() {
    return query("SELECT * FROM cash_registers ORDER BY id ASC");
  },

  async findActiveShift(userId) {
    const register = await this.getDefaultRegister();
    if (!register) return null;
    const shift = await queryOne(
      `SELECT * FROM cash_shifts
       WHERE status = 'open' AND register_id = ?
         AND (opened_by_user_id = ? OR opened_by_user_id IS NULL)
       ORDER BY id DESC LIMIT 1`,
      [register.id, userId ?? null],
    );
    if (!shift) return null;

    if (shift.opened_by_user_id == null && userId != null) {
      const claimedNow = await this.claimOrphanShift(shift.id, userId);
      if (claimedNow) {
        shift.opened_by_user_id = userId;
        return shift;
      }
      // Race: kasir lain menang klaim shift ini beberapa milidetik lebih
      // dulu (lihat claimOrphanShift). Ambil ulang data TERBARU — kalau
      // ternyata sudah dimiliki kasir lain (atau shift ini baru saja
      // ditutup di antara SELECT & UPDATE di atas), shift ini bukan lagi
      // sesi aktif milik userId ini.
      const fresh = await queryOne("SELECT * FROM cash_shifts WHERE id = ?", [
        shift.id,
      ]);
      if (
        !fresh ||
        fresh.status !== "open" ||
        (fresh.opened_by_user_id != null && fresh.opened_by_user_id !== userId)
      ) {
        return null;
      }
      return fresh;
    }
    return shift;
  },

  // Klaim atomic satu shift ber-owner NULL untuk seorang kasir. Dipakai
  // dari findActiveShift() di atas, dan juga dari cashRegisterService untuk
  // titik-titik yang mengambil shift lewat findShiftById langsung (bukan
  // findActiveShift) — yaitu closeShift & deleteMovement, yang sebelumnya
  // jadi celah karena assertOwnsShift sendiri sengaja melewatkan owner NULL.
  // WHERE ... IS NULL membuat UPDATE ini atomic: kalau dua request nyaris
  // bersamaan sama-sama mencoba klaim shift NULL yang sama, hanya SATU yang
  // benar-benar mengubah baris ini (affectedRows > 0) — request lain yang
  // kalah akan melihat affectedRows = 0 dan tahu harus mengecek ulang siapa
  // pemilik sebenarnya sekarang, bukan memaksakan klaimnya sendiri.
  async claimOrphanShift(shiftId, userId) {
    if (userId == null) return false;
    const result = await execute(
      `UPDATE cash_shifts SET opened_by_user_id = ?
       WHERE id = ? AND status = 'open' AND opened_by_user_id IS NULL`,
      [userId, shiftId],
    );
    return result.affectedRows > 0;
  },

  findOpenShiftForRegister(registerId) {
    return queryOne(
      "SELECT * FROM cash_shifts WHERE status = 'open' AND register_id = ? LIMIT 1",
      [registerId],
    );
  },

  findAllOpenShifts() {
    return query(
      `SELECT cs.*, u.name AS cashier_name, cr.code AS register_code, cr.name AS register_name
       FROM cash_shifts cs
       LEFT JOIN users u ON u.id = cs.opened_by_user_id
       LEFT JOIN cash_registers cr ON cr.id = cs.register_id
       WHERE cs.status = 'open'
       ORDER BY cs.opened_at ASC`,
    );
  },

  findShiftById(id) {
    return queryOne("SELECT * FROM cash_shifts WHERE id = ?", [id]);
  },

  async createShift({
    registerId,
    shiftCode,
    openingBalance,
    openingNotes,
    openedBy,
    openedByUserId,
    occurredAt,
  }) {
    try {
      return await insert(
        `INSERT INTO cash_shifts
           (shift_code, register_id, opening_balance, opening_notes, opened_by, opened_by_user_id, opened_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
        [
          shiftCode,
          registerId,
          openingBalance,
          openingNotes || "",
          openedBy || "Admin",
          openedByUserId ?? null,
          occurredAt,
        ],
      );
    } catch (err) {
      if (
        err.code === "ER_DUP_ENTRY" &&
        err.message?.includes("uq_cash_shifts_single_open_per_register")
      ) {
        throw new ValidationError(
          "Laci kas ini masih memiliki sesi yang terbuka. Tutup sesi tersebut terlebih dahulu sebelum membuka sesi baru",
        );
      }
      throw err;
    }
  },

  closeShift(
    id,
    {
      closingBalancePhysical,
      closingNotes,
      closedBy,
      closedByUserId,
      occurredAt,
      buildSummary,
    },
  ) {
    return transaction(async (conn) => {
      const [lockRows] = await conn.execute(
        "SELECT * FROM cash_shifts WHERE id = ? FOR UPDATE",
        [id],
      );
      const current = lockRows[0];
      if (!current) throw new NotFoundError("Sesi kas tidak ditemukan");
      if (current.status !== "open") {
        throw new ValidationError("Sesi kas ini sudah ditutup sebelumnya");
      }

      const summary = await buildSummary(current, conn);
      const physical =
        Math.round((Number(closingBalancePhysical) || 0) * 100) / 100;
      const difference =
        Math.round((physical - summary.expected_balance) * 100) / 100;

      await conn.execute(
        `UPDATE cash_shifts SET
           closing_balance_system = ?, closing_balance_physical = ?, difference = ?,
           total_cash_sales = ?, total_cash_in = ?, total_cash_out = ?,
           total_cash_receivable = ?, total_cash_payable = ?, total_cash_purchase = ?,
           total_cash_capital_in = ?, total_cash_capital_out = ?, total_cash_expense = ?,
           closing_notes = ?, closed_by = ?, closed_by_user_id = ?, closed_at = ?, status = 'closed'
         WHERE id = ?`,
        [
          summary.expected_balance,
          physical,
          difference,
          summary.total_cash_sales,
          summary.total_cash_in,
          summary.total_cash_out,
          summary.total_cash_receivable,
          summary.total_cash_payable,
          summary.total_cash_purchase,
          summary.total_cash_capital_in,
          summary.total_cash_capital_out,
          summary.total_cash_expense,
          closingNotes || "",
          closedBy || "Admin",
          closedByUserId ?? null,
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

  findMovementsByShift(shiftId, conn = null) {
    return query(
      "SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY created_at DESC, id DESC",
      [shiftId],
      conn,
    );
  },

  findMovementById(id) {
    return queryOne("SELECT * FROM cash_movements WHERE id = ?", [id]);
  },

  createMovement({
    shiftId,
    type,
    category,
    amount,
    description,
    createdBy,
    createdByUserId,
    occurredAt,
  }) {
    return transaction(async (conn) => {
      if (!shiftId) throw new NotFoundError("Sesi kas tidak ditemukan");
      const shift = await lockOpenShift(conn, shiftId, createdByUserId);

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
      await journalService.postCashMovementJournal(
        movement,
        shift.shift_code,
        conn,
      );
      return movement;
    });
  },

  deleteMovement(id, actorUserId) {
    return transaction(async (conn) => {
      const [movRows] = await conn.execute(
        "SELECT * FROM cash_movements WHERE id = ?",
        [id],
      );
      const movement = movRows[0];
      if (!movement) return null;

      const shift = await lockOpenShift(conn, movement.shift_id, actorUserId);
      if (!shift) {
        throw new NotFoundError(
          "Sesi kas untuk pergerakan ini tidak ditemukan",
        );
      }

      await journalService.postVoidCashMovementJournal(
        movement,
        shift.shift_code,
        conn,
      );
      await conn.execute("DELETE FROM cash_movements WHERE id = ?", [id]);
      return movement;
    });
  },

  sumMovements(shiftId) {
    return query(
      `SELECT type, COALESCE(SUM(amount),0) AS total
       FROM cash_movements WHERE shift_id = ? GROUP BY type`,
      [shiftId],
    );
  },

  sumCashSales(shiftId, conn = null) {
    return queryOne(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN payment_method = 'cash' THEN final_amount
             WHEN payment_method = 'open_bill' THEN payment_amount
             ELSE 0
           END
         ), 0) AS total_cash_sales
       FROM transactions
       WHERE status = 'completed'
         AND shift_id = ?
         AND (payment_method = 'cash' OR (payment_method = 'open_bill' AND payment_amount > 0))`,
      [shiftId],
      conn,
    );
  },

  sumCashReceivablePayments(shiftId, conn = null) {
    return queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM receivable_payments
       WHERE shift_id = ?`,
      [shiftId],
      conn,
    );
  },

  sumCashPayablePayments(shiftId, conn = null) {
    return queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payable_payments
       WHERE shift_id = ?`,
      [shiftId],
      conn,
    );
  },

  sumCashPurchases(shiftId, conn = null) {
    return queryOne(
      `SELECT COALESCE(SUM(total_cost), 0) AS total
       FROM purchases
       WHERE shift_id = ?`,
      [shiftId],
      conn,
    );
  },

  sumCashCapital(shiftId, conn = null) {
    return queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'setoran' THEN amount ELSE 0 END), 0) AS total_in,
         COALESCE(SUM(CASE WHEN type = 'penarikan' THEN amount ELSE 0 END), 0) AS total_out
       FROM capital_transactions
       WHERE shift_id = ?`,
      [shiftId],
      conn,
    );
  },

  sumCashExpenses(shiftId, conn = null) {
    return queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE shift_id = ?`,
      [shiftId],
      conn,
    );
  },

  // ─── Laporan Kas Masuk / Kas Keluar (lintas shift, per rentang tanggal) ──
  // Berbeda dari findMovementsByShift() yang dibatasi 1 shift — dipakai
  // untuk rekap Kas Masuk & Kas Keluar di menu Laporan. Ikut sertakan
  // shift_code (JOIN cash_shifts) supaya bisa ditelusuri ke sesi kas asal.
  reportMovements(startDate, endDate) {
    return query(
      `SELECT cm.*, cs.shift_code
       FROM cash_movements cm
       JOIN cash_shifts cs ON cs.id = cm.shift_id
       WHERE DATE(cm.created_at) BETWEEN ? AND ?
       ORDER BY cm.created_at ASC`,
      [startDate, endDate],
    );
  },

  // Modal awal tiap sesi kas yang DIBUKA dalam rentang tanggal — salah satu
  // sumber "Kas Masuk" (lihat permintaan laporan: Kas Awal).
  reportShiftOpenings(startDate, endDate) {
    return query(
      `SELECT id, shift_code, opening_balance, opening_notes, opened_by, opened_at
       FROM cash_shifts
       WHERE DATE(opened_at) BETWEEN ? AND ?
       ORDER BY opened_at ASC`,
      [startDate, endDate],
    );
  },

  // Penjualan tunai (cash) direkap PER HARI (bukan per transaksi — itu sudah
  // ada di Laporan Penjualan Harian) sebagai satu baris "Kas Masuk" per hari,
  // pakai rumus yang sama dengan sumCashSales() di atas.
  reportCashSalesByDay(startDate, endDate) {
    return query(
      `SELECT DATE(created_at) AS sale_date,
          COALESCE(SUM(
            CASE
              WHEN payment_method = 'cash' THEN final_amount
              WHEN payment_method = 'open_bill' THEN payment_amount
              ELSE 0
            END
          ), 0) AS total_cash_sales
       FROM transactions
       WHERE status = 'completed'
         AND (payment_method = 'cash' OR (payment_method = 'open_bill' AND payment_amount > 0))
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       HAVING total_cash_sales > 0
       ORDER BY sale_date ASC`,
      [startDate, endDate],
    );
  },
};

module.exports = cashRegisterModel;
