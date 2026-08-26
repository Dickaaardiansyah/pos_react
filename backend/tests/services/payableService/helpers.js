// tests/services/payableService/helpers.js
const { getPool } = require("../../../config/database");

async function seedSystemAccounts() {
  const pool = getPool();
  const accounts = [
    ["1100", "Kas", "aset", "debit"],
    ["1150", "Kas di Bank", "aset", "debit"],
    ["2100", "Utang Usaha", "kewajiban", "kredit"],
    ["3100", "Modal Pemilik", "modal", "kredit"],
    ["3300", "Saldo Awal / Penyesuaian", "modal", "kredit"],
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

async function seedRegisterAndShift(userId = 2, openingBalance = 500000) {
  const pool = getPool();
  const [reg] = await pool.query(
    `INSERT INTO cash_registers (code, name, is_active) VALUES (?, ?, 1)`,
    [`LACI-P-${Date.now()}`, "Kasir Payable"],
  );
  const [shift] = await pool.query(
    `INSERT INTO cash_shifts
       (shift_code, register_id, opening_balance, opened_by, opened_by_user_id, status)
     VALUES (?, ?, ?, ?, ?, 'open')`,
    [`SH-P-${Date.now()}`, reg.insertId, openingBalance, "Kasir Test", userId],
  );
  return { registerId: reg.insertId, shiftId: shift.insertId };
}

async function seedKasKantorBalance(amount = 1_000_000) {
  await seedSystemAccounts();
  const pool = getPool();
  const date = new Date().toISOString().split("T")[0];
  const [[kas]] = await pool.query(
    "SELECT id FROM chart_of_accounts WHERE account_code = '1100'",
  );
  const [[modal]] = await pool.query(
    "SELECT id FROM chart_of_accounts WHERE account_code = '3100'",
  );
  const [entry] = await pool.query(
    `INSERT INTO journal_entries
       (entry_code, entry_date, description, reference_type, total_debit, total_credit, source, created_by, status)
     VALUES (?, ?, 'Seed kas test', 'manual', ?, ?, 'manual', 'Test', 'posted')`,
    [`JU-P-${Date.now()}`, date, amount, amount],
  );
  await pool.query(
    `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description, line_order)
     VALUES (?, ?, ?, 0, 'Seed kas', 0), (?, ?, 0, ?, 'Seed modal', 1)`,
    [entry.insertId, kas.id, amount, entry.insertId, modal.id, amount],
  );
}

async function seedBankBalance(amount = 1_000_000) {
  await seedSystemAccounts();
  const pool = getPool();
  const date = new Date().toISOString().split("T")[0];
  const [[bank]] = await pool.query(
    "SELECT id FROM chart_of_accounts WHERE account_code = '1150'",
  );
  const [[modal]] = await pool.query(
    "SELECT id FROM chart_of_accounts WHERE account_code = '3100'",
  );
  const [entry] = await pool.query(
    `INSERT INTO journal_entries
       (entry_code, entry_date, description, reference_type, total_debit, total_credit, source, created_by, status)
     VALUES (?, ?, 'Seed bank test', 'manual', ?, ?, 'manual', 'Test', 'posted')`,
    [`JU-B-${Date.now()}`, date, amount, amount],
  );
  await pool.query(
    `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description, line_order)
     VALUES (?, ?, ?, 0, 'Seed bank', 0), (?, ?, 0, ?, 'Seed modal', 1)`,
    [entry.insertId, bank.id, amount, entry.insertId, modal.id, amount],
  );
}

async function getPayable(id) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT * FROM payables WHERE id = ?", [id]);
  return row || null;
}

async function getPayments(payableId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM payable_payments WHERE payable_id = ? ORDER BY id",
    [payableId],
  );
  return rows;
}

function futureDueDate(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  seedSystemAccounts,
  seedRegisterAndShift,
  seedKasKantorBalance,
  seedBankBalance,
  getPayable,
  getPayments,
  futureDueDate,
};
