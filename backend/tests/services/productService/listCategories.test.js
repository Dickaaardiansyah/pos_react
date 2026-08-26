// tests/services/productService/listCategories.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.listCategories (SATU FUNGSI SAJA)
// Daftar kategori + product_count (produk aktif per kategori).
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const { productService } = require("../../../services/productService");

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

async function insertProduct({ barcode, name, categoryId, isActive = 1 }) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO products (barcode, name, price, stock, min_stock, category_id, is_active)
     VALUES (?, ?, 1000, 0, 5, ?, ?)`,
    [barcode, name, categoryId, isActive],
  );
  return result.insertId;
}

describe("productService.listCategories", () => {
  test("mengembalikan array kosong jika belum ada kategori", async () => {
    const list = await productService.listCategories();
    expect(list).toEqual([]);
  });

  test("mengembalikan semua kategori diurutkan nama ASC + product_count", async () => {
    const catB = await insertCategory("Bahan");
    const catA = await insertCategory("Aneka");
    await insertProduct({ barcode: "1", name: "P1", categoryId: catA });
    await insertProduct({ barcode: "2", name: "P2", categoryId: catA });
    await insertProduct({
      barcode: "3",
      name: "P3 nonaktif",
      categoryId: catA,
      isActive: 0,
    });
    await insertProduct({ barcode: "4", name: "P4", categoryId: catB });

    const list = await productService.listCategories();
    expect(list.map((c) => c.name)).toEqual(["Aneka", "Bahan"]);

    const aneka = list.find((c) => c.id === catA);
    const bahan = list.find((c) => c.id === catB);
    // product_count hanya menghitung produk aktif
    expect(Number(aneka.product_count)).toBe(2);
    expect(Number(bahan.product_count)).toBe(1);
  });
});
