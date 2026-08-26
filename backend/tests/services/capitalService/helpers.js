const { getPool } = require("../../../config/database");

async function seedSystemAccounts() {
  const pool = getPool();
  const accounts = [
    ["1100", "Kas", "aset", "debit"],
    ["1150", "Kas di Bank", "aset", "debit"],
    ["3100", "Modal Pemilik", "modal", "kredit"],
    ["3200", "Prive", "modal", "debit"],
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
    [`LACI-C-${Date.now()}`, "Kasir Capital"],
  );
  const [shift] = await pool.query(
    `INSERT INTO cash_shifts
       (shift_code, register_id, opening_balance, opened_by, opened_by_user_id, status)
     VALUES (?, ?, ?, ?, ?, 'open')`,
    [`SH-C-${Date.now()}`, reg.insertId, openingBalance, "Kasir Test", userId],
  );
  return { registerId: reg.insertId, shiftId: shift.insertId };
}

async function seedKasBalance(amount = 1_000_000) {
  await seedSystemAccounts();
  const pool = getPool();
  const date = new Date().toISOString().slice(0, 10);
  const [[kas]] = await pool.query(
    "SELECT id FROM chart_of_accounts WHERE account_code = '1100'",
  );
  const [[modal]] = await pool.query(
    "SELECT id FROM chart_of_accounts WHERE account_code = '3100'",
  );
  const [entry] = await pool.query(
    `INSERT INTO journal_entries
       (entry_code, entry_date, description, reference_type, total_debit, total_credit, source, created_by, status)
     VALUES (?, ?, 'Seed kas', 'manual', ?, ?, 'manual', 'Test', 'posted')`,
    [`JU-C-${Date.now()}`, date, amount, amount],
  );
  await pool.query(
    `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description, line_order)
     VALUES (?, ?, ?, 0, 'Seed', 0), (?, ?, 0, ?, 'Seed', 1)`,
    [entry.insertId, kas.id, amount, entry.insertId, modal.id, amount],
  );
}

async function getCapital(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    "SELECT * FROM capital_transactions WHERE id = ?",
    [id],
  );
  return row || null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  seedSystemAccounts,
  seedRegisterAndShift,
  seedKasBalance,
  getCapital,
  today,
};
