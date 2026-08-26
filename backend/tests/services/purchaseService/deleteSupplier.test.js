// tests/services/purchaseService/deleteSupplier.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — purchaseService.deleteSupplier (SATU FUNGSI SAJA)
// Soft-delete (deactivate) supplier.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const purchaseService = require("../../../services/purchaseService");
const { insertSupplier } = require("./helpers");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

describe("purchaseService.deleteSupplier", () => {
  test("menonaktifkan supplier (is_active = 0), baris tetap ada", async () => {
    const id = await insertSupplier({ name: "Akan Nonaktif" });
    await purchaseService.deleteSupplier(id);

    const pool = getPool();
    const [[row]] = await pool.query("SELECT * FROM suppliers WHERE id = ?", [
      id,
    ]);
    expect(row).not.toBeNull();
    expect(Number(row.is_active)).toBe(0);
  });
});
