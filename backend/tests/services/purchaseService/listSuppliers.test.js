// tests/services/purchaseService/listSuppliers.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — purchaseService.listSuppliers (SATU FUNGSI SAJA)
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
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

describe("purchaseService.listSuppliers", () => {
  test("kosong jika belum ada supplier", async () => {
    const list = await purchaseService.listSuppliers();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(0);
  });

  test("mengembalikan supplier yang di-insert", async () => {
    await insertSupplier({ name: "Alpha Supplier" });
    await insertSupplier({ name: "Beta Supplier" });

    const list = await purchaseService.listSuppliers();
    expect(list.length).toBeGreaterThanOrEqual(2);
    const names = list.map((s) => s.name);
    expect(names).toContain("Alpha Supplier");
    expect(names).toContain("Beta Supplier");
  });
});
