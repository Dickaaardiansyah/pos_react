// tests/services/purchaseService/updateSupplier.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — purchaseService.updateSupplier (SATU FUNGSI SAJA)
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const purchaseService = require("../../../services/purchaseService");
const { NotFoundError } = require("../../../services/productService");
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

describe("purchaseService.updateSupplier", () => {
  test("melempar NotFoundError jika supplier tidak ada", async () => {
    await expect(
      purchaseService.updateSupplier(999999, { name: "X" }),
    ).rejects.toThrow(NotFoundError);
  });

  test("berhasil update nama & phone", async () => {
    const id = await insertSupplier({ name: "Lama", phone: "000" });
    const result = await purchaseService.updateSupplier(id, {
      name: "Baru",
      phone: "081999",
    });

    expect(result.name).toBe("Baru");
    expect(result.phone).toBe("081999");

    const pool = getPool();
    const [[row]] = await pool.query("SELECT * FROM suppliers WHERE id = ?", [
      id,
    ]);
    expect(row.name).toBe("Baru");
  });

  test("bisa menonaktifkan via is_active", async () => {
    const id = await insertSupplier({ name: "Nonaktifkan" });
    await purchaseService.updateSupplier(id, { is_active: 0 });
    const pool = getPool();
    const [[row]] = await pool.query("SELECT * FROM suppliers WHERE id = ?", [
      id,
    ]);
    expect(Number(row.is_active)).toBe(0);
  });
});
