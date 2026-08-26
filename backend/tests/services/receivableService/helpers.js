// tests/services/receivableService/helpers.js
// Piutang manual tidak lagi dibuat lewat service — seed langsung ke DB.
const { getPool } = require("../../../config/database");

async function seedSystemAccounts() {
  const pool = getPool();
  const accounts = [
    ["1100", "Kas", "aset", "debit"],
    ["1150", "Kas di Bank", "aset", "debit"],
    ["1300", "Piutang Usaha", "aset", "debit"],
    ["3100", "Modal Pemilik", "modal", "kredit"],
    ["3300", "Saldo Awal / Penyesuaian", "modal", "kredit"],
    ["4100", "Penjualan", "pendapatan", "kredit"],
  ];
  for (const [code, name, type, balance] of accounts) {
    await pool.query(
      `INSERT INTO chart_of_accounts
         (account_code, account_name, account_type, normal_balance, is_active, is_system)
       VALUES (?, ?, ?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE account_name = VALUES(account_name)`,
      [code, name, type, balance],
    );
  }
}

async function seedRegisterAndShift(userId = 2, openingBalance = 100000) {
  const pool = getPool();
  const [reg] = await pool.query(
    `INSERT INTO cash_registers (code, name, is_active) VALUES (?, ?, 1)`,
    [`LACI-R-${Date.now()}`, "Kasir Receivable"],
  );
  const [shift] = await pool.query(
    `INSERT INTO cash_shifts
       (shift_code, register_id, opening_balance, opened_by, opened_by_user_id, status)
     VALUES (?, ?, ?, ?, ?, 'open')`,
    [`SH-R-${Date.now()}`, reg.insertId, openingBalance, "Kasir Test", userId],
  );
  return { registerId: reg.insertId, shiftId: shift.insertId };
}

async function insertReceivable(overrides = {}) {
  const pool = getPool();
  const invoiceCode =
    overrides.invoiceCode ||
    `PIU-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const invoiceDate =
    overrides.invoiceDate || new Date().toISOString().slice(0, 10);
  const due = new Date();
  due.setDate(due.getDate() + (overrides.dueDays ?? 30));
  const dueDate = overrides.dueDate || due.toISOString().slice(0, 10);

  const [result] = await pool.query(
    `INSERT INTO receivables
       (invoice_code, customer_id, customer_name, transaction_id, amount, paid_amount,
        invoice_date, due_date, status, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceCode,
      overrides.customerId || null,
      overrides.customerName || "Pelanggan Test",
      overrides.transactionId || null,
      overrides.amount ?? 100000,
      overrides.paidAmount ?? 0,
      invoiceDate,
      dueDate,
      overrides.status || "belum_lunas",
      overrides.notes || "",
      overrides.recordedBy || "Admin",
    ],
  );
  return result.insertId;
}

async function getReceivable(id) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT * FROM receivables WHERE id = ?", [
    id,
  ]);
  return row || null;
}

async function getPayments(receivableId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM receivable_payments WHERE receivable_id = ? ORDER BY id",
    [receivableId],
  );
  return rows;
}

module.exports = {
  seedSystemAccounts,
  seedRegisterAndShift,
  insertReceivable,
  getReceivable,
  getPayments,
};
