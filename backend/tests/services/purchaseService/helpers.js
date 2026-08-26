// tests/services/purchaseService/helpers.js
// ─────────────────────────────────────────────────────────────────────────────
// Helper bersama integration test purchaseService (self-contained).
// ─────────────────────────────────────────────────────────────────────────────
const { getPool } = require("../../../config/database");

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

async function insertProduct(overrides = {}) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO products
       (barcode, name, price, cost_price, stock, min_stock, unit, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      overrides.barcode || `BC-${Date.now()}-${Math.random()}`,
      overrides.name || "Produk Beli",
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
      overrides.openingBalance ?? 500000,
      overrides.openingNotes || "",
      overrides.openedBy || "Kasir Test",
      userId,
    ],
  );
  return { registerId, shiftId: result.insertId };
}

async function insertSupplier(overrides = {}) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO suppliers (name, phone, address, notes, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      overrides.name || "Supplier Test",
      overrides.phone || "08123456789",
      overrides.address || "Jl. Test",
      overrides.notes || "",
      overrides.isActive ?? 1,
    ],
  );
  return result.insertId;
}

async function getPurchase(id) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT * FROM purchases WHERE id = ?", [
    id,
  ]);
  return row || null;
}

async function getPurchaseItems(purchaseId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM purchase_items WHERE purchase_id = ?",
    [purchaseId],
  );
  return rows;
}

/** Seed saldo Kas Kantor (1100): Dr Kas, Cr Modal 3100 */
async function seedKasKantorBalance(amount = 1_000_000, entryDate = null) {
  await seedSystemAccounts();
  const pool = getPool();
  const date = entryDate || new Date().toISOString().split("T")[0];
  const code = `JU-SEED-${Date.now()}`;

  const [[kas]] = await pool.query(
    "SELECT id FROM chart_of_accounts WHERE account_code = '1100'",
  );
  const [[modal]] = await pool.query(
    "SELECT id FROM chart_of_accounts WHERE account_code = '3100'",
  );
  if (!kas || !modal) throw new Error("COA 1100/3100 belum di-seed");

  const [entry] = await pool.query(
    `INSERT INTO journal_entries
       (entry_code, entry_date, description, reference_type, total_debit, total_credit, source, created_by, status)
     VALUES (?, ?, 'Seed saldo kas test', 'manual', ?, ?, 'manual', 'Test', 'posted')`,
    [code, date, amount, amount],
  );
  const entryId = entry.insertId;
  await pool.query(
    `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description, line_order)
     VALUES (?, ?, ?, 0, 'Seed kas', 0), (?, ?, 0, ?, 'Seed modal', 1)`,
    [entryId, kas.id, amount, entryId, modal.id, amount],
  );
  return entryId;
}

async function seedCreditReady(productOverrides = {}) {
  await seedSystemAccounts();
  const productId = await insertProduct({
    barcode: `PRC-${Date.now()}`,
    name: "Barang Beli",
    price: 15000,
    costPrice: 10000,
    stock: 10,
    ...productOverrides,
  });
  return { productId };
}

async function seedLaciReady({
  userId = 2,
  openingBalance = 500000,
  product,
} = {}) {
  await seedSystemAccounts();
  const { registerId, shiftId } = await openShiftForUser(userId, {
    openingBalance,
  });
  const productId = await insertProduct(
    product || {
      barcode: `PRC-L-${Date.now()}`,
      name: "Barang Laci",
      price: 12000,
      costPrice: 8000,
      stock: 5,
    },
  );
  return { registerId, shiftId, productId, userId };
}

module.exports = {
  seedSystemAccounts,
  insertProduct,
  getProductStock,
  openShiftForUser,
  insertSupplier,
  getPurchase,
  getPurchaseItems,
  seedKasKantorBalance,
  seedCreditReady,
  seedLaciReady,
};
