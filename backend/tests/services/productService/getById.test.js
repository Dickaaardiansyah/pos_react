// tests/services/productService/getById.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.getById (SATU FUNGSI SAJA)
// Ambil produk by id (termasuk nonaktif — findById tidak filter is_active)
// + lampiran units/variants.
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
      overrides.barcode || `BC-${Date.now()}-${Math.random()}`,
      overrides.name || "Produk Test",
      overrides.price ?? 10000,
      overrides.stock ?? 0,
      overrides.minStock ?? 5,
      overrides.isActive ?? 1,
    ],
  );
  return result.insertId;
}

describe("productService.getById", () => {
  test("melempar NotFoundError jika id tidak ada", async () => {
    await expect(productService.getById(999999)).rejects.toThrow(NotFoundError);
  });

  test("berhasil mengembalikan produk aktif", async () => {
    const id = await insertProduct({
      barcode: "GID1",
      name: "Sabun Cair",
      price: 12000,
    });
    const product = await productService.getById(id);
    expect(product).toMatchObject({
      id,
      barcode: "GID1",
      name: "Sabun Cair",
    });
    expect(product.additional_units).toEqual([]);
    expect(Array.isArray(product.variants)).toBe(true);
  });

  test("produk nonaktif tetap bisa diload by id (untuk halaman edit)", async () => {
    const id = await insertProduct({
      barcode: "GID2",
      name: "Produk Lama",
      isActive: 0,
    });
    const product = await productService.getById(id);
    expect(product.id).toBe(id);
    expect(Number(product.is_active)).toBe(0);
  });
});
