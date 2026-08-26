// tests/services/productService/deleteCategory.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.deleteCategory (SATU FUNGSI SAJA)
// Hapus kategori; produk yang pakai kategori ini jadi category_id NULL
// (FK ON DELETE SET NULL). Return affectedProducts.
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

async function insertCategory(name) {
  const pool = getPool();
  const [result] = await pool.query(
    "INSERT INTO categories (name) VALUES (?)",
    [name],
  );
  return result.insertId;
}

async function insertProduct({ barcode, name, categoryId }) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO products (barcode, name, price, stock, min_stock, category_id)
     VALUES (?, ?, 1000, 0, 5, ?)`,
    [barcode, name, categoryId],
  );
  return result.insertId;
}

async function getCategory(id) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT * FROM categories WHERE id = ?", [
    id,
  ]);
  return row || null;
}

async function getProduct(id) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT * FROM products WHERE id = ?", [id]);
  return row || null;
}

describe("productService.deleteCategory", () => {
  test("melempar NotFoundError jika kategori tidak ada", async () => {
    await expect(productService.deleteCategory(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("hapus kategori kosong: affectedProducts = 0", async () => {
    const catId = await insertCategory("Kosong");
    const result = await productService.deleteCategory(catId);
    expect(result).toEqual({ affectedProducts: 0 });
    expect(await getCategory(catId)).toBeNull();
  });

  test("hapus kategori yang masih dipakai: produk tetap ada, category_id jadi null", async () => {
    const catId = await insertCategory("Minuman");
    const p1 = await insertProduct({
      barcode: "C1",
      name: "Teh",
      categoryId: catId,
    });
    const p2 = await insertProduct({
      barcode: "C2",
      name: "Kopi",
      categoryId: catId,
    });

    const result = await productService.deleteCategory(catId);
    expect(result.affectedProducts).toBe(2);
    expect(await getCategory(catId)).toBeNull();

    const row1 = await getProduct(p1);
    const row2 = await getProduct(p2);
    expect(row1).not.toBeNull();
    expect(row2).not.toBeNull();
    // ON DELETE SET NULL — category_id harus null (jika FK sudah di-setup)
    expect(row1.category_id).toBeNull();
    expect(row2.category_id).toBeNull();
  });
});
