// tests/services/cashRegisterService/helpers.js
const { getPool } = require("../../../config/database");

async function seedSystemAccounts() {
  const pool = getPool();
  const accounts = [
    ["1100", "Kas", "aset", "debit"],
    ["1150", "Kas di Bank", "aset", "debit"],
    ["3100", "Modal Pemilik", "modal", "kredit"],
    ["3200", "Prive", "modal", "debit"],
    ["4900", "Pendapatan Lain-lain", "pendapatan", "kredit"],
    ["5310", "Beban Kas Kecil Lainnya", "beban", "debit"],
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

async function seedRegister(overrides = {}) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO cash_registers (code, name, is_active) VALUES (?, ?, 1)`,
    [
      overrides.code || `LACI-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      overrides.name || "Kasir Utama",
    ],
  );
  return result.insertId;
}

async function getShift(id) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT * FROM cash_shifts WHERE id = ?", [
    id,
  ]);
  return row || null;
}

async function getMovements(shiftId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY id",
    [shiftId],
  );
  return rows;
}

/** Seed register saja (belum ada shift) */
async function seedRegisterOnly() {
  await seedSystemAccounts();
  const registerId = await seedRegister();
  return { registerId };
}

module.exports = {
  seedSystemAccounts,
  seedRegister,
  getShift,
  getMovements,
  seedRegisterOnly,
};
