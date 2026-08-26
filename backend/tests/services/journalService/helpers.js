// tests/services/journalService/helpers.js
const { getPool } = require("../../../config/database");

async function seedSystemAccounts() {
  const pool = getPool();
  const accounts = [
    ["1100", "Kas", "aset", "debit"],
    ["1150", "Kas di Bank", "aset", "debit"],
    ["1200", "Persediaan", "aset", "debit"],
    ["1300", "Piutang Usaha", "aset", "debit"],
    ["2100", "Utang Usaha", "kewajiban", "kredit"],
    ["2110", "Utang Gaji", "kewajiban", "kredit"],
    ["2120", "Utang Listrik", "kewajiban", "kredit"],
    ["2130", "Utang Beban Lainnya", "kewajiban", "kredit"],
    ["3100", "Modal Pemilik", "modal", "kredit"],
    ["3200", "Prive", "modal", "debit"],
    ["3300", "Saldo Awal / Penyesuaian", "modal", "kredit"],
    ["4100", "Penjualan", "pendapatan", "kredit"],
    ["4200", "Diskon Penjualan", "pendapatan", "debit"],
    ["4900", "Pendapatan Lain-lain", "pendapatan", "kredit"],
    ["5100", "HPP", "beban", "debit"],
    ["5220", "Beban Gaji", "beban", "debit"],
    ["5230", "Beban Listrik & Air", "beban", "debit"],
    ["5280", "Beban Lainnya", "beban", "debit"],
  ];
  for (const [code, name, type, balance] of accounts) {
    await pool.query(
      `INSERT INTO chart_of_accounts
         (account_code, account_name, account_type, normal_balance, is_active, is_system)
       VALUES (?, ?, ?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE account_name = VALUES(account_name), is_system = 1`,
      [code, name, type, balance],
    );
  }
}

async function getAccountByCode(code) {
  const pool = getPool();
  const [[row]] = await pool.query(
    "SELECT * FROM chart_of_accounts WHERE account_code = ?",
    [code],
  );
  return row || null;
}

async function getEntry(id) {
  const pool = getPool();
  const [[row]] = await pool.query(
    "SELECT * FROM journal_entries WHERE id = ?",
    [id],
  );
  return row || null;
}

async function getLines(entryId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM journal_lines WHERE entry_id = ? ORDER BY line_order, id",
    [entryId],
  );
  return rows;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  seedSystemAccounts,
  getAccountByCode,
  getEntry,
  getLines,
  today,
};
