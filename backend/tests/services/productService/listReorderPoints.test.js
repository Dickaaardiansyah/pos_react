// tests/services/productService/listReorderPoints.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.listReorderPoints (SATU FUNGSI SAJA)
// Hanya produk aktif + lead_time_value terisi yang masuk daftar ROP.
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
    `INSERT INTO products
       (barcode, name, price, stock, min_stock, lead_time_value, safety_stock_value, rop_time_unit, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      overrides.barcode || `BC-${Date.now()}-${Math.random()}`,
      overrides.name || "Produk Test",
      overrides.price ?? 10000,
      overrides.stock ?? 0,
      overrides.minStock ?? 5,
      overrides.leadTimeValue ?? null,
      overrides.safetyStockValue ?? null,
      overrides.ropTimeUnit || "hari",
      overrides.isActive ?? 1,
    ],
  );
  return result.insertId;
}

describe("productService.listReorderPoints", () => {
  test("produk tanpa lead_time_value tidak masuk daftar", async () => {
    await insertProduct({
      barcode: "ROP0",
      name: "Tanpa Lead Time",
      leadTimeValue: null,
      stock: 1,
    });

    const result = await productService.listReorderPoints({});
    expect(result.items).toEqual([]);
    expect(result.meta).toMatchObject({
      period_mode: expect.any(String),
    });
  });

  test("produk aktif dengan lead_time_value masuk items + meta window_days", async () => {
    await insertProduct({
      barcode: "ROP1",
      name: "Ada Lead Time",
      stock: 100,
      leadTimeValue: 3,
      safetyStockValue: 1,
      ropTimeUnit: "hari",
    });
    // produk nonaktif dengan lead time — tidak ikut
    await insertProduct({
      barcode: "ROP2",
      name: "Nonaktif",
      stock: 0,
      leadTimeValue: 5,
      isActive: 0,
    });

    const result = await productService.listReorderPoints({ days: 30 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      name: "Ada Lead Time",
      barcode: "ROP1",
    });
    expect(typeof result.items[0].reorder_point).toBe("number");
    expect(typeof result.items[0].needs_reorder).toBe("boolean");
    expect(result.meta).toMatchObject({
      window_days: 30,
      period_mode: "manual",
    });
  });

  test("mode auto (days kosong): period_mode auto & items tetap array", async () => {
    await insertProduct({
      barcode: "ROP3",
      name: "Auto Mode",
      stock: 50,
      leadTimeValue: 2,
      safetyStockValue: 0.5,
    });

    const result = await productService.listReorderPoints({});
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.meta.period_mode).toBe("auto");
    expect(typeof result.meta.window_days).toBe("number");
  });

  test("stok sangat rendah → needs_reorder true (tanpa histori jual, avg sales ≈ 0, ROP dari safety)", async () => {
    await insertProduct({
      barcode: "ROP4",
      name: "Stok Tipis",
      stock: 0,
      leadTimeValue: 7,
      safetyStockValue: 2,
    });

    const result = await productService.listReorderPoints({ days: 14 });
    expect(result.items).toHaveLength(1);
    // reorder_point >= 0; stock 0 → needs_reorder true selama ROP >= 0
    expect(result.items[0].needs_reorder).toBe(true);
  });
});
