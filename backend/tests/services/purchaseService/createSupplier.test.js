// tests/services/purchaseService/createSupplier.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — purchaseService.createSupplier (SATU FUNGSI SAJA)
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const purchaseService = require("../../../services/purchaseService");
const { ValidationError } = require("../../../services/productService");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

describe("purchaseService.createSupplier", () => {
  test("menolak jika nama kosong", async () => {
    await expect(
      purchaseService.createSupplier({ name: "" }),
    ).rejects.toThrow(ValidationError);
    await expect(
      purchaseService.createSupplier({ name: null }),
    ).rejects.toThrow("Nama supplier wajib diisi");
  });

  test("berhasil membuat supplier dan mengembalikan baris lengkap", async () => {
    const result = await purchaseService.createSupplier({
      name: "CV Maju Jaya",
      phone: "081111",
      address: "Jl. Industri 1",
      notes: "Supplier utama",
    });

    expect(result).toMatchObject({
      name: "CV Maju Jaya",
      phone: "081111",
      address: "Jl. Industri 1",
    });
    expect(result.id).toBeGreaterThan(0);

    const pool = getPool();
    const [[row]] = await pool.query("SELECT * FROM suppliers WHERE id = ?", [
      result.id,
    ]);
    expect(row.name).toBe("CV Maju Jaya");
    expect(Number(row.is_active)).toBe(1);
  });
});
