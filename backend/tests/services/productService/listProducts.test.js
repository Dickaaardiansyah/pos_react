// tests/services/productService/listProducts.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.listProducts (SATU FUNGSI SAJA)
// Filter kategori / search / low_stock + lampiran additional_units & variants.
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

async function insertProduct(overrides = {}) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO products (barcode, name, price, stock, min_stock, category_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      overrides.barcode || `BC-${Date.now()}-${Math.random()}`,
      overrides.name || "Produk Test",
      overrides.price ?? 10000,
      overrides.stock ?? 0,
      overrides.minStock ?? 5,
      overrides.categoryId ?? null,
      overrides.isActive ?? 1,
    ],
  );
  return result.insertId;
}

describe("productService.listProducts", () => {
  test("mengembalikan array kosong jika belum ada produk aktif", async () => {
    const list = await productService.listProducts({});
    expect(list).toEqual([]);
  });

  test("hanya menampilkan produk is_active = 1", async () => {
    await insertProduct({ barcode: "A1", name: "Aktif", isActive: 1 });
    await insertProduct({ barcode: "A2", name: "Nonaktif", isActive: 0 });

    const list = await productService.listProducts({});
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Aktif");
    expect(list[0].additional_units).toEqual([]);
    expect(list[0].variants).toEqual([]);
  });

  test("filter search: cocok nama atau barcode (partial, case-insensitive via LIKE)", async () => {
    await insertProduct({ barcode: "899111", name: "Teh Botol" });
    await insertProduct({ barcode: "899222", name: "Kopi Sachet" });

    const byName = await productService.listProducts({ search: "Teh" });
    expect(byName).toHaveLength(1);
    expect(byName[0].name).toBe("Teh Botol");

    const byBarcode = await productService.listProducts({ search: "899222" });
    expect(byBarcode).toHaveLength(1);
    expect(byBarcode[0].name).toBe("Kopi Sachet");
  });

  test("filter category: hanya produk dengan category_id tersebut", async () => {
    const catMinuman = await insertCategory("Minuman");
    const catSnack = await insertCategory("Snack");
    await insertProduct({
      barcode: "M1",
      name: "Es Teh",
      categoryId: catMinuman,
    });
    await insertProduct({
      barcode: "S1",
      name: "Keripik",
      categoryId: catSnack,
    });

    const list = await productService.listProducts({ category: catMinuman });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Es Teh");
    expect(list[0].category_name).toBe("Minuman");
  });

  test("filter low_stock=true: hanya produk stock <= min_stock", async () => {
    await insertProduct({
      barcode: "L1",
      name: "Hampir Habis",
      stock: 2,
      minStock: 5,
    });
    await insertProduct({
      barcode: "L2",
      name: "Masih Banyak",
      stock: 100,
      minStock: 5,
    });

    const list = await productService.listProducts({ low_stock: "true" });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Hampir Habis");
  });

  test("low_stock selain string 'true' tidak memfilter", async () => {
    await insertProduct({ barcode: "X1", name: "A", stock: 1, minStock: 5 });
    await insertProduct({ barcode: "X2", name: "B", stock: 99, minStock: 5 });

    const list = await productService.listProducts({ low_stock: "false" });
    expect(list).toHaveLength(2);
  });

  test("hasil diurutkan berdasarkan nama ASC", async () => {
    await insertProduct({ barcode: "Z1", name: "Zebra" });
    await insertProduct({ barcode: "A9", name: "Apel" });
    await insertProduct({ barcode: "M5", name: "Mangga" });

    const list = await productService.listProducts({});
    expect(list.map((p) => p.name)).toEqual(["Apel", "Mangga", "Zebra"]);
  });
});
