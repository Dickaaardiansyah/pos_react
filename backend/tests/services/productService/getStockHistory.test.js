// tests/services/productService/getStockHistory.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.getStockHistory (SATU FUNGSI SAJA)
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

async function insertProduct(overrides = {}) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO products (barcode, name, price, stock, min_stock)
     VALUES (?, ?, ?, ?, ?)`,
    [
      overrides.barcode || `BC-${Date.now()}-${Math.random()}`,
      overrides.name || "Produk Test",
      overrides.price ?? 10000,
      overrides.stock ?? 0,
      overrides.minStock ?? 5,
    ],
  );
  return result.insertId;
}

describe("productService.getStockHistory", () => {
  test("mengembalikan array kosong jika belum ada riwayat", async () => {
    const id = await insertProduct({ barcode: "H0", name: "Tanpa History" });
    const history = await productService.getStockHistory(id);
    expect(history).toEqual([]);
  });

  test("mengembalikan riwayat setelah updateStock, urut terbaru dulu", async () => {
    const id = await insertProduct({
      barcode: "H1",
      name: "Dengan History",
      stock: 10,
    });
    const user = { name: "Admin Test" };

    await productService.updateStock(id, { quantity: 5, type: "in" }, user);
    await productService.updateStock(id, { quantity: 3, type: "out" }, user);

    const history = await productService.getStockHistory(id);
    expect(history.length).toBeGreaterThanOrEqual(2);
    // ORDER BY created_at DESC — yang terakhir (out) di index 0
    expect(history[0]).toMatchObject({
      type: "out",
      product_name: "Dengan History",
    });
    expect(Number(history[0].quantity)).toBe(3);
    expect(history[1].type).toBe("in");
  });
});
