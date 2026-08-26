// tests/services/productService/deleteProduct.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.deleteProduct (SATU FUNGSI SAJA)
// Soft-delete (is_active = 0); baris tetap ada di DB.
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

async function getProduct(id) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT * FROM products WHERE id = ?", [id]);
  return row || null;
}

describe("productService.deleteProduct", () => {
  test("melempar NotFoundError jika produk tidak ada", async () => {
    await expect(productService.deleteProduct(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("soft-delete: is_active jadi 0, baris tetap ada", async () => {
    const id = await insertProduct({ barcode: "DEL1", name: "Akan Dihapus" });
    await productService.deleteProduct(id);

    const row = await getProduct(id);
    expect(row).not.toBeNull();
    expect(Number(row.is_active)).toBe(0);
    expect(row.name).toBe("Akan Dihapus");
  });

  test("setelah soft-delete, produk tidak muncul di listProducts", async () => {
    const id = await insertProduct({ barcode: "DEL2", name: "Hilang Dari List" });
    await productService.deleteProduct(id);

    const list = await productService.listProducts({});
    expect(list.find((p) => p.id === id)).toBeUndefined();
  });

  test("setelah soft-delete, getByBarcode gagal NotFound", async () => {
    await insertProduct({ barcode: "DEL3", name: "Barcode Hilang" });
    await productService.deleteProduct(
      (await getProductByBarcode("DEL3")).id,
    );
    await expect(productService.getByBarcode("DEL3")).rejects.toThrow(
      NotFoundError,
    );
  });
});

async function getProductByBarcode(barcode) {
  const pool = getPool();
  const [[row]] = await pool.query(
    "SELECT * FROM products WHERE barcode = ?",
    [barcode],
  );
  return row;
}
