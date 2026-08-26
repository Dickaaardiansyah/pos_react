// tests/services/productService/getByBarcode.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.getByBarcode (SATU FUNGSI SAJA)
// Cari produk aktif by barcode + lampiran units/variants; NotFound jika absen.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const {
  productService,
  NotFoundError,
} = require("../../../services/productService");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

async function insertProduct(overrides = {}) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO products (barcode, name, price, stock, min_stock, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      overrides.barcode || `BC-${Date.now()}`,
      overrides.name || "Produk Test",
      overrides.price ?? 10000,
      overrides.stock ?? 0,
      overrides.minStock ?? 5,
      overrides.isActive ?? 1,
    ],
  );
  return result.insertId;
}

describe("productService.getByBarcode", () => {
  test("melempar NotFoundError jika barcode tidak ada", async () => {
    await expect(productService.getByBarcode("TIDAKADA")).rejects.toThrow(
      NotFoundError,
    );
    await expect(productService.getByBarcode("TIDAKADA")).rejects.toThrow(
      "Produk tidak ditemukan",
    );
  });

  test("melempar NotFoundError jika produk ada tapi sudah nonaktif", async () => {
    await insertProduct({ barcode: "INACTIVE1", isActive: 0 });
    await expect(productService.getByBarcode("INACTIVE1")).rejects.toThrow(
      NotFoundError,
    );
  });

  test("berhasil mengembalikan produk aktif + additional_units & variants (kosong default)", async () => {
    const id = await insertProduct({
      barcode: "8999001",
      name: "Indomie Goreng",
      price: 3500,
      stock: 40,
    });

    const product = await productService.getByBarcode("8999001");
    expect(product).toMatchObject({
      id,
      barcode: "8999001",
      name: "Indomie Goreng",
    });
    expect(Number(product.price)).toBe(3500);
    expect(Number(product.stock)).toBe(40);
    expect(product.additional_units).toEqual([]);
    expect(product.variants).toEqual([]);
  });
});
