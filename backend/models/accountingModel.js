// models/accountingModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — modul akuntansi baru: biaya operasional (expenses) dan
// data mentah yang dibutuhkan untuk menyusun Laporan Laba Rugi.
// ─────────────────────────────────────────────────────────────────────────────
const {
  query,
  queryOne,
  insert,
  execute,
  transaction,
} = require("../config/database");
const journalService = require("../services/journalService");
const {
  lockOpenShift,
  lockShiftAndCheckBalance,
} = require("./shiftLockHelper");

const accountingModel = {
  // ─── Biaya operasional (operating expenses) ────────────────────────────
  findExpenses({ startDate, endDate, category }) {
    let where = "WHERE 1=1";
    const params = [];
    if (startDate) {
      where += " AND expense_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND expense_date <= ?";
      params.push(endDate);
    }
    if (category) {
      where += " AND category = ?";
      params.push(category);
    }
    return query(
      `SELECT * FROM expenses ${where} ORDER BY expense_date DESC, id DESC`,
      params,
    );
  },

  findExpenseById(id) {
    return queryOne("SELECT * FROM expenses WHERE id = ?", [id]);
  },

  // Catat biaya operasional + posting jurnal (Dr Beban sesuai kategori, Cr
  // Kas) dalam satu DB transaction — kalau jurnal gagal, insert biaya ini
  // ikut rollback (tidak lagi best-effort).
  createExpense({
    expenseDate,
    category,
    description,
    amount,
    recordedBy,
    shiftId,
    shiftUserId,
  }) {
    return transaction(async (conn) => {
      await lockShiftAndCheckBalance(
        conn,
        shiftId,
        shiftUserId,
        amount,
        "biaya ini",
      );

      const [result] = await conn.execute(
        `INSERT INTO expenses (expense_date, category, description, amount, shift_id, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          expenseDate,
          category,
          description || "",
          amount,
          shiftId || null,
          recordedBy || "Admin",
        ],
      );
      const [rows] = await conn.execute("SELECT * FROM expenses WHERE id = ?", [
        result.insertId,
      ]);
      const expense = rows[0];
      await journalService.postExpenseJournal(expense, conn);
      return expense;
    });
  },

  // Edit biaya operasional. Jurnal yang sudah posting tidak diedit
  // langsung (immutable) — sebelum UPDATE, jurnal LAMA (pakai data
  // `existing`, sebelum perubahan) dibalik dulu via postVoidExpenseJournal,
  // baru setelah UPDATE, jurnal BARU diposting via postExpenseJournal
  // dengan nilai terkini. Semua dalam satu DB transaction supaya atomic.
  updateExpense(id, existing, patch) {
    return transaction(async (conn) => {
      const oldAmount = Number(existing.amount);
      const newAmount = Number(patch.amount ?? existing.amount);
      const additionalOutflow = Math.max(0, newAmount - oldAmount);

      await lockShiftAndCheckBalance(
        conn,
        existing.shift_id,
        null,
        additionalOutflow,
        "perubahan biaya ini",
      );

      await journalService.postVoidExpenseJournal(existing, conn);

      await conn.execute(
        `UPDATE expenses SET expense_date=?, category=?, description=?, amount=? WHERE id=?`,
        [
          patch.expenseDate ?? existing.expense_date,
          patch.category ?? existing.category,
          patch.description ?? existing.description,
          patch.amount ?? existing.amount,
          id,
        ],
      );

      const [rows] = await conn.execute("SELECT * FROM expenses WHERE id = ?", [
        id,
      ]);
      const updated = rows[0];
      await journalService.postExpenseJournal(updated, conn);
      return updated;
    });
  },

  // Hapus biaya operasional + posting jurnal pembalik dalam SATU DB
  // transaction — kalau jurnal pembalik gagal, DELETE ini ikut rollback.
  // `existing` (data sebelum dihapus) wajib dikirim caller supaya jumlah
  // yang dibalik sama persis dengan yang pernah diposting.
  deleteExpense(id, existing) {
    return transaction(async (conn) => {
      await lockShiftAndCheckBalance(conn, existing.shift_id, null, null);

      await journalService.postVoidExpenseJournal(existing, conn);
      await conn.execute("DELETE FROM expenses WHERE id = ?", [id]);
    });
  },

  totalExpensesInPeriod(startDate, endDate) {
    return queryOne(
      `SELECT COALESCE(SUM(amount),0) AS total_expenses
       FROM expenses WHERE expense_date BETWEEN ? AND ?`,
      [startDate, endDate],
    );
  },

  expensesGroupedByCategory(startDate, endDate) {
    return query(
      `SELECT category, COALESCE(SUM(amount),0) AS total, COUNT(*) AS entry_count
       FROM expenses WHERE expense_date BETWEEN ? AND ?
       GROUP BY category ORDER BY total DESC`,
      [startDate, endDate],
    );
  },

  // ─── Perbandingan HPP historis untuk tren margin bulanan (12 bulan) ────────
  monthlyGrossProfitTrend() {
    return query(
      `SELECT
         DATE_FORMAT(t.created_at, '%Y-%m') AS month,
         COALESCE(SUM(ti.subtotal), 0)              AS revenue,
         COALESCE(SUM(ti.unit_cost * ti.quantity),0) AS cogs
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE t.status = 'completed'
         AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(t.created_at, '%Y-%m')
       ORDER BY month ASC`,
    );
  },

  // ─── Total biaya operasional per bulan (12 bulan) — dipasangkan dengan
  // monthlyGrossProfitTrend() di service layer untuk menghasilkan tren
  // Laba Bersih bulanan (Laba Kotor - Beban Operasional). ──────────────────
  monthlyOperatingExpenseTrend() {
    return query(
      `SELECT
         DATE_FORMAT(expense_date, '%Y-%m') AS month,
         COALESCE(SUM(amount), 0) AS operating_expenses
       FROM expenses
       WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(expense_date, '%Y-%m')
       ORDER BY month ASC`,
    );
  },
};

module.exports = accountingModel;
