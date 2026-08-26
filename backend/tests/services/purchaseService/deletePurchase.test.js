// tests/services/purchaseService/deletePurchase.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — purchaseService.deletePurchase (SATU FUNGSI SAJA)
// Pembelian confirmed tidak boleh dihapus.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const purchaseService = require("../../../services/purchaseService");
const {
  ValidationError,
  NotFoundError,
} = require("../../../services/productService");
const { seedCreditReady } = require("./helpers");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

const admin = { id: 1, name: "Admin Test" };

describe("purchaseService.deletePurchase", () => {
  test("melempar NotFoundError jika pembelian tidak ada", async () => {
    await expect(purchaseService.deletePurchase(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("menolak hapus pembelian yang sudah confirmed", async () => {
    const { productId } = await seedCreditReady();
    const purchase = await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 1, unit_cost: 1000 }],
        payment_method: "kredit",
        supplier_name: "Tidak Boleh Hapus",
      },
      admin,
    );

    // createPurchase default status = confirmed
    await expect(purchaseService.deletePurchase(purchase.id)).rejects.toThrow(
      ValidationError,
    );
    await expect(purchaseService.deletePurchase(purchase.id)).rejects.toThrow(
      /tidak dapat dihapus/i,
    );

    const pool = getPool();
    const [[row]] = await pool.query("SELECT * FROM purchases WHERE id = ?", [
      purchase.id,
    ]);
    expect(row).not.toBeNull();
  });

  test("boleh hapus jika status draft", async () => {
    const { productId } = await seedCreditReady();
    const purchase = await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 1, unit_cost: 1000 }],
        payment_method: "kredit",
        supplier_name: "Draft Hapus",
      },
      admin,
    );

    const pool = getPool();
    await pool.query("UPDATE purchases SET status = 'draft' WHERE id = ?", [
      purchase.id,
    ]);

    await purchaseService.deletePurchase(purchase.id);

    const [[row]] = await pool.query("SELECT * FROM purchases WHERE id = ?", [
      purchase.id,
    ]);
    expect(row).toBeNull();
  });
});
