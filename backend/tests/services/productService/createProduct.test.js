// tests/services/productService/createProduct.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.createProduct (TAMBAH BARANG, SATU FUNGSI SAJA)
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
  await resetDatabase(); // kosongkan semua tabel + seed user admin(id1)/kasir(id2) dasar
});

async function findProductByBarcode(barcode) {
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM products WHERE barcode = ?", [
    barcode,
  ]);
  return rows[0] || null;
}

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

describe("productService.createProduct (tambah barang)", () => {
  test("menolak jika barcode/nama/harga tidak lengkap", async () => {
    await expect(
      productService.createProduct({ barcode: "123", name: "", price: 1000 }),
    ).rejects.toThrow("Barcode, nama, dan harga wajib diisi");
  });

  test("menolak barcode yang sudah dipakai produk lain", async () => {
    await insertProduct({ barcode: "8991234" });
    await expect(
      productService.createProduct({
        barcode: "8991234",
        name: "Kopi",
        price: 15000,
      }),
    ).rejects.toThrow("Barcode sudah digunakan");
  });

  test("berhasil tambah barang baru dengan data minimal (barcode, nama, harga)", async () => {
    await productService.createProduct({
      barcode: "200",
      name: "Teh Botol",
      price: 5000,
    });
    const saved = await findProductByBarcode("200");
    expect(saved).not.toBeNull();
    expect(saved.name).toBe("Teh Botol");
    expect(Number(saved.price)).toBe(5000);
    expect(Number(saved.stock)).toBe(0); // default kalau tidak diisi
    expect(Number(saved.min_stock)).toBe(5); // default
  });

  test("harga grosir diisi TANPA jumlah beli minimum: ditolak (mencegah data grosir tidak konsisten)", async () => {
    await expect(
      productService.createProduct({
        barcode: "111",
        name: "Beras 5kg",
        price: 65000,
        price_wholesale: 60000,
        // min_qty_wholesale sengaja tidak diisi
      }),
    ).rejects.toThrow("Isi jumlah beli minimum grosir");
  });

  test("harga grosir & jumlah beli minimum valid (>= 2): tersimpan apa adanya", async () => {
    await productService.createProduct({
      barcode: "111b",
      name: "Beras 5kg",
      price: 65000,
      price_wholesale: 60000,
      min_qty_wholesale: 3,
    });
    const saved = await findProductByBarcode("111b");
    expect(Number(saved.price_wholesale)).toBe(60000);
    expect(Number(saved.min_qty_wholesale)).toBe(3);
  });

  test("jumlah beli minimum grosir < 2 tetap ditolak walau diisi", async () => {
    await expect(
      productService.createProduct({
        barcode: "111c",
        name: "Beras 5kg",
        price: 65000,
        price_wholesale: 60000,
        min_qty_wholesale: 1,
      }),
    ).rejects.toThrow("minimal 2");
  });

  test("harga grosir kosong/0: price_wholesale & min_qty_wholesale ikut null (tidak dipaksakan)", async () => {
    await productService.createProduct({
      barcode: "112",
      name: "Gula 1kg",
      price: 15000,
      price_wholesale: 0,
    });
    const saved = await findProductByBarcode("112");
    expect(saved.price_wholesale).toBeNull();
    expect(saved.min_qty_wholesale).toBeNull();
  });

  test("stok awal > 0 tercatat sebagai riwayat stok masuk (reference: initial)", async () => {
    await productService.createProduct({
      barcode: "113",
      name: "Minyak Goreng",
      price: 20000,
      stock: 50,
    });
    const saved = await findProductByBarcode("113");
    const pool = getPool();
    const [history] = await pool.query(
      "SELECT * FROM stock_history WHERE product_id = ?",
      [saved.id],
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      type: "in",
      reference: "initial",
      previous_stock: 0,
      new_stock: 50,
    });
    expect(Number(history[0].quantity)).toBe(50);
  });

  test("stok awal 0/tidak diisi: TIDAK membuat riwayat stok", async () => {
    await productService.createProduct({
      barcode: "114",
      name: "Sabun",
      price: 5000,
    });
    const saved = await findProductByBarcode("114");
    const pool = getPool();
    const [history] = await pool.query(
      "SELECT * FROM stock_history WHERE product_id = ?",
      [saved.id],
    );
    expect(history).toHaveLength(0);
  });

  test("kategori (category_id) tersimpan kalau diisi", async () => {
    const pool = getPool();
    const [catResult] = await pool.query(
      "INSERT INTO categories (name) VALUES (?)",
      ["Minuman"],
    );
    await productService.createProduct({
      barcode: "115",
      name: "Kopi Susu",
      price: 12000,
      category_id: catResult.insertId,
    });
    const saved = await findProductByBarcode("115");
    expect(saved.category_id).toBe(catResult.insertId);
  });
});
