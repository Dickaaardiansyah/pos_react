const { getPool } = require("../../../config/database");

async function seedSystemAccounts() {
  const pool = getPool();
  const accounts = [
    ["1100", "Kas", "aset", "debit"],
    ["1150", "Kas di Bank", "aset", "debit"],
    ["1200", "Persediaan", "aset", "debit"],
    ["3100", "Modal Pemilik", "modal", "kredit"],
    ["4100", "Penjualan", "pendapatan", "kredit"],
    ["4200", "Diskon Penjualan", "pendapatan", "debit"],
    ["4900", "Pendapatan Lain-lain", "pendapatan", "kredit"],
    ["5100", "HPP", "beban", "debit"],
    ["5210", "Beban Sewa", "beban", "debit"],
    ["5220", "Beban Gaji", "beban", "debit"],
    ["5230", "Beban Listrik & Air", "beban", "debit"],
    ["5240", "Beban Pemasaran", "beban", "debit"],
    ["5250", "Beban Transportasi", "beban", "debit"],
    ["5260", "Beban Perawatan", "beban", "debit"],
    ["5270", "Beban Administrasi", "beban", "debit"],
    ["5280", "Beban Lainnya", "beban", "debit"],
    ["5310", "Beban Kas Kecil", "beban", "debit"],
    ["5900", "Beban Selisih Kas", "beban", "debit"],
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
    [`JU-A-${Date.now()}`, date, amount, amount],
  );
  await pool.query(
    `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description, line_order)
     VALUES (?, ?, ?, 0, 'Seed', 0), (?, ?, 0, ?, 'Seed', 1)`,
    [entry.insertId, kas.id, amount, entry.insertId, modal.id, amount],
  );
}

async function seedRegisterAndShift(userId = 2, openingBalance = 500000) {
  const pool = getPool();
  const [reg] = await pool.query(
    `INSERT INTO cash_registers (code, name, is_active) VALUES (?, ?, 1)`,
    [`LACI-A-${Date.now()}`, "Kasir Accounting"],
  );
  const [shift] = await pool.query(
    `INSERT INTO cash_shifts
       (shift_code, register_id, opening_balance, opened_by, opened_by_user_id, status)
     VALUES (?, ?, ?, ?, ?, 'open')`,
    [`SH-A-${Date.now()}`, reg.insertId, openingBalance, "Kasir Test", userId],
  );
  return { registerId: reg.insertId, shiftId: shift.insertId };
}

async function getExpense(id) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT * FROM expenses WHERE id = ?", [id]);
  return row || null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  seedSystemAccounts,
  seedKasBalance,
  seedRegisterAndShift,
  getExpense,
  today,
};
