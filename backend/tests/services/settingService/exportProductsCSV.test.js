// tests/services/settingService/exportProductsCSV.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — settingService.exportProductsCSV (SATU FUNGSI SAJA)
// CSV header + baris produk (aktif & nonaktif).
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const { settingService } = require("../../../services/settingService");

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

async function insertProduct(overrides = {}) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO products (barcode, name, price, cost_price, stock, min_stock, unit, category_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      overrides.barcode || `BC-${Date.now()}`,
      overrides.name || "Produk Test",
      overrides.price ?? 10000,
      overrides.costPrice ?? 7000,
      overrides.stock ?? 5,
      overrides.minStock ?? 2,
      overrides.unit || "pcs",
      overrides.categoryId ?? null,
      overrides.isActive ?? 1,
    ],
  );
  return result.insertId;
}

describe("settingService.exportProductsCSV", () => {
  test("tanpa produk: mengembalikan string kosong (header saja tidak ada karena rows kosong)", async () => {
    const csv = await settingService.exportProductsCSV();
    // toCSV([]) → ""
    expect(csv).toBe("");
  });

  test("dengan produk: header CSV + baris data", async () => {
    const catId = await insertCategory("Minuman");
    await insertProduct({
      barcode: "8991",
      name: "Teh Botol",
      price: 5000,
      costPrice: 3000,
      stock: 20,
      categoryId: catId,
      isActive: 1,
    });
    await insertProduct({
      barcode: "8992",
      name: "Kopi Bubuk",
      price: 15000,
      isActive: 0,
    });

    const csv = await settingService.exportProductsCSV();
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Barcode");
    expect(lines[0]).toContain("Nama Produk");
    expect(lines[0]).toContain("Kategori");
    expect(lines[0]).toContain("Status");

    // minimal 1 header + 2 data
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(csv).toContain("8991");
    expect(csv).toContain("Teh Botol");
    expect(csv).toContain("Minuman");
    expect(csv).toContain("Aktif");
    expect(csv).toContain("Nonaktif");
    expect(csv).toContain("Kopi Bubuk");
  });
});
