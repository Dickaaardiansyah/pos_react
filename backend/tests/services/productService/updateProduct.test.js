// tests/services/productService/updateProduct.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.updateProduct (SATU FUNGSI SAJA)
// Update field, aturan harga grosir, NotFound, partial update.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const {
  productService,
  NotFoundError,
  ValidationError,
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
    `INSERT INTO products (barcode, name, price, stock, min_stock, price_wholesale, min_qty_wholesale, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      overrides.barcode || `BC-${Date.now()}-${Math.random()}`,
      overrides.name || "Produk Test",
      overrides.price ?? 10000,
      overrides.stock ?? 0,
      overrides.minStock ?? 5,
      overrides.priceWholesale ?? null,
      overrides.minQtyWholesale ?? null,
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

describe("productService.updateProduct", () => {
  test("melempar NotFoundError jika produk tidak ada", async () => {
    await expect(
      productService.updateProduct(999999, { name: "X" }),
    ).rejects.toThrow(NotFoundError);
  });

  test("berhasil update nama & harga", async () => {
    const id = await insertProduct({
      barcode: "UP1",
      name: "Lama",
      price: 5000,
    });

    const result = await productService.updateProduct(id, {
      name: "Baru",
      price: 7500,
    });

    expect(result.name).toBe("Baru");
    expect(Number(result.price)).toBe(7500);

    const row = await getProduct(id);
    expect(row.name).toBe("Baru");
    expect(Number(row.price)).toBe(7500);
    expect(row.barcode).toBe("UP1"); // tidak diubah
  });

  test("partial update: field yang tidak dikirim tetap nilai lama", async () => {
    const id = await insertProduct({
      barcode: "UP2",
      name: "Tetap",
      price: 9000,
      minStock: 10,
    });

    await productService.updateProduct(id, { price: 11000 });

    const row = await getProduct(id);
    expect(row.name).toBe("Tetap");
    expect(Number(row.price)).toBe(11000);
    expect(Number(row.min_stock)).toBe(10);
  });

  test("harga grosir diisi tanpa min_qty_wholesale: ditolak", async () => {
    const id = await insertProduct({ barcode: "UP3", name: "Grosir" });
    await expect(
      productService.updateProduct(id, {
        price_wholesale: 8000,
        // min_qty_wholesale sengaja kosong
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("harga grosir + min_qty >= 2: tersimpan", async () => {
    const id = await insertProduct({ barcode: "UP4", name: "Grosir OK" });
    await productService.updateProduct(id, {
      price_wholesale: 8000,
      min_qty_wholesale: 5,
    });
    const row = await getProduct(id);
    expect(Number(row.price_wholesale)).toBe(8000);
    expect(Number(row.min_qty_wholesale)).toBe(5);
  });

  test("price_wholesale 0/kosong: wholesale fields jadi null", async () => {
    const id = await insertProduct({
      barcode: "UP5",
      name: "Hapus Grosir",
      priceWholesale: 9000,
      minQtyWholesale: 3,
    });
    await productService.updateProduct(id, {
      price_wholesale: 0,
      min_qty_wholesale: 3,
    });
    const row = await getProduct(id);
    expect(row.price_wholesale).toBeNull();
    expect(row.min_qty_wholesale).toBeNull();
  });

  test("bisa menonaktifkan produk via is_active", async () => {
    const id = await insertProduct({ barcode: "UP6", name: "Nonaktifkan" });
    await productService.updateProduct(id, { is_active: 0 });
    const row = await getProduct(id);
    expect(Number(row.is_active)).toBe(0);
  });
});
