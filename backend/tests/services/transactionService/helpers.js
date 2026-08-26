// tests/services/transactionService/helpers.js
// ─────────────────────────────────────────────────────────────────────────────
// Helper bersama untuk integration test transactionService.
// Seed: COA sistem, laci kas, sesi kas open, produk berstok.
// ─────────────────────────────────────────────────────────────────────────────
const { getPool } = require("../../../config/database");

/** Seed akun sistem minimal yang dipakai postSaleJournal / postVoidSaleJournal */
async function seedSystemAccounts() {
  const pool = getPool();
  const accounts = [
    ["1100", "Kas", "aset", "debit"],
    ["1150", "Kas di Bank / Non-Tunai", "aset", "debit"],
    ["1200", "Persediaan Barang Dagang", "aset", "debit"],
    ["1300", "Piutang Usaha", "aset", "debit"],
    ["2100", "Utang Usaha", "kewajiban", "kredit"],
    ["3100", "Modal Pemilik", "modal", "kredit"],
    ["4100", "Penjualan", "pendapatan", "kredit"],
    ["4200", "Diskon Penjualan", "pendapatan", "debit"],
    ["5100", "Harga Pokok Penjualan (HPP)", "beban", "debit"],
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

/** Buat laci kas aktif; return register id */
async function seedCashRegister(overrides = {}) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO cash_registers (code, name, is_active) VALUES (?, ?, 1)`,
    [
      overrides.code || `LACI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      overrides.name || "Kasir Test",
    ],
  );
  return result.insertId;
}

/**
 * Buka sesi kas untuk userId (default kasir seed id=2).
 * Return { registerId, shiftId }
 */
async function openShiftForUser(userId = 2, overrides = {}) {
  const pool = getPool();
  const registerId = overrides.registerId || (await seedCashRegister());
  const shiftCode =
    overrides.shiftCode ||
    `SH-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const [result] = await pool.query(
    `INSERT INTO cash_shifts
       (shift_code, register_id, opening_balance, opening_notes, opened_by, opened_by_user_id, status)
     VALUES (?, ?, ?, ?, ?, ?, 'open')`,
    [
      shiftCode,
      registerId,
      overrides.openingBalance ?? 100000,
      overrides.openingNotes || "",
      overrides.openedBy || "Kasir Test",
      userId,
    ],
  );
  return { registerId, shiftId: result.insertId };
}

async function insertProduct(overrides = {}) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO products
       (barcode, name, price, cost_price, stock, min_stock, unit, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      overrides.barcode || `BC-${Date.now()}-${Math.random()}`,
      overrides.name || "Produk Kasir",
      overrides.price ?? 10000,
      overrides.costPrice ?? 6000,
      overrides.stock ?? 100,
      overrides.minStock ?? 5,
      overrides.unit || "pcs",
    ],
  );
  return result.insertId;
}

async function getProductStock(productId) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT stock FROM products WHERE id = ?", [
    productId,
  ]);
  return row ? Number(row.stock) : null;
}

async function getTransaction(id) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT * FROM transactions WHERE id = ?", [
    id,
  ]);
  return row || null;
}

async function getTransactionItems(transactionId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM transaction_items WHERE transaction_id = ?",
    [transactionId],
  );
  return rows;
}

async function countJournalByReference(referenceCode) {
  const pool = getPool();
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS c FROM journal_entries WHERE reference_code = ?",
    [referenceCode],
  );
  return Number(row?.c || 0);
}

/** Seed lengkap untuk checkout: COA + shift + produk. userId default kasir=2 */
async function seedCheckoutReady({ userId = 2, product } = {}) {
  await seedSystemAccounts();
  const { registerId, shiftId } = await openShiftForUser(userId);
  const productId = await insertProduct(product || {});
  return { registerId, shiftId, productId, userId };
}

module.exports = {
  seedSystemAccounts,
  seedCashRegister,
  openShiftForUser,
  insertProduct,
  getProductStock,
  getTransaction,
  getTransactionItems,
  countJournalByReference,
  seedCheckoutReady,
};
