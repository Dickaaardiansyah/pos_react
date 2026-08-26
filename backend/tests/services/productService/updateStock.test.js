// tests/services/productService/updateStock.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.updateStock (SATU FUNGSI SAJA)
// Penyesuaian stok atomik: in / out / adjustment + riwayat stock_history.
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

async function getStock(productId) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT stock FROM products WHERE id = ?", [
    productId,
  ]);
  return row ? Number(row.stock) : null;
}

async function getLatestHistory(productId) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT * FROM stock_history WHERE product_id = ? ORDER BY id DESC LIMIT 1`,
    [productId],
  );
  return row || null;
}

describe("productService.updateStock (penyesuaian stok atomik)", () => {
  const user = { name: "Admin Toko" };

  test("menolak jenis perubahan stok yang tidak dikenal", async () => {
    const productId = await insertProduct({ stock: 10 });
    await expect(
      productService.updateStock(
        productId,
        { quantity: 5, type: "invalid" },
        user,
      ),
    ).rejects.toThrow("Jenis perubahan stok tidak valid");
  });

  test("menolak jumlah non-numerik", async () => {
    const productId = await insertProduct({ stock: 10 });
    await expect(
      productService.updateStock(
        productId,
        { quantity: "abc", type: "in" },
        user,
      ),
    ).rejects.toThrow("Jumlah harus berupa angka");
  });

  test("menolak jumlah <= 0 untuk tipe in/out", async () => {
    const productId = await insertProduct({ stock: 10 });
    await expect(
      productService.updateStock(productId, { quantity: 0, type: "in" }, user),
    ).rejects.toThrow("harus lebih besar dari 0");
  });

  test("menolak hasil penyesuaian (adjustment) bernilai negatif", async () => {
    const productId = await insertProduct({ stock: 10 });
    await expect(
      productService.updateStock(
        productId,
        { quantity: -5, type: "adjustment" },
        user,
      ),
    ).rejects.toThrow("tidak boleh negatif");
  });

  test("tipe 'in': menambah stok sesuai jumlah + catat riwayat", async () => {
    const productId = await insertProduct({ stock: 100 });
    await productService.updateStock(
      productId,
      { quantity: 20, type: "in" },
      user,
    );
    expect(await getStock(productId)).toBe(120);

    const history = await getLatestHistory(productId);
    expect(history).toMatchObject({
      type: "in",
      previous_stock: 100,
      new_stock: 120,
      created_by: "Admin Toko",
    });
    expect(Number(history.quantity)).toBe(20);
  });

  test("tipe 'out': menolak jika hasilnya negatif (stok tidak mencukupi) — stok tidak berubah", async () => {
    const productId = await insertProduct({ stock: 10 });
    await expect(
      productService.updateStock(
        productId,
        { quantity: 15, type: "out" },
        user,
      ),
    ).rejects.toThrow("Stok tidak mencukupi");
    expect(await getStock(productId)).toBe(10);
  });

  test("tipe 'out': berhasil mengurangi stok jika mencukupi + catat riwayat", async () => {
    const productId = await insertProduct({ stock: 10 });
    await productService.updateStock(
      productId,
      { quantity: 5, type: "out" },
      user,
    );
    expect(await getStock(productId)).toBe(5);

    const history = await getLatestHistory(productId);
    expect(history).toMatchObject({
      type: "out",
      previous_stock: 10,
      new_stock: 5,
    });
    expect(Number(history.quantity)).toBe(5);
  });

  test("tipe 'adjustment': stok baru = nilai input (bukan penjumlahan/pengurangan)", async () => {
    const productId = await insertProduct({ stock: 999 });
    await productService.updateStock(
      productId,
      { quantity: 30, type: "adjustment" },
      user,
    );
    expect(await getStock(productId)).toBe(30);

    const history = await getLatestHistory(productId);
    expect(history).toMatchObject({
      type: "adjustment",
      previous_stock: 999,
      new_stock: 30,
    });
  });

  test("createdBy SELALU diambil dari user token (bukan dari body), fallback 'Admin' jika kosong", async () => {
    const productId = await insertProduct({ stock: 10 });
    await productService.updateStock(
      productId,
      { quantity: 5, type: "in" },
      {},
    );
    const history = await getLatestHistory(productId);
    expect(history.created_by).toBe("Admin");
  });

  test("melempar NotFoundError jika produk tidak ada", async () => {
    await expect(
      productService.updateStock(999999, { quantity: 5, type: "in" }, user),
    ).rejects.toThrow(NotFoundError);
  });
});
