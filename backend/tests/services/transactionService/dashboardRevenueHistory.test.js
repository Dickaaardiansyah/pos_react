// tests/services/transactionService/dashboardRevenueHistory.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — transactionService.dashboardRevenueHistory (SATU FUNGSI SAJA)
// Array { date, tx_count, revenue } untuk N hari terakhir.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const {
  transactionService,
} = require("../../../services/transactionService");
const { seedCheckoutReady } = require("./helpers");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

const kasir = { id: 2, name: "Kasir Test" };

describe("transactionService.dashboardRevenueHistory", () => {
  test("tanpa transaksi: array (bisa kosong atau isi 0)", async () => {
    const rows = await transactionService.dashboardRevenueHistory(7);
    expect(Array.isArray(rows)).toBe(true);
    for (const r of rows) {
      expect(r).toHaveProperty("date");
      expect(typeof r.tx_count).toBe("number");
      expect(typeof r.revenue).toBe("number");
    }
  });

  test("setelah checkout hari ini: ada baris dengan revenue > 0", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "DRH1", name: "Dashboard", price: 9000, stock: 10 },
    });
    await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 1 }],
        payment_method: "cash",
        payment_amount: 9000,
      },
      kasir,
    );

    const rows = await transactionService.dashboardRevenueHistory(7);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalTx = rows.reduce((s, r) => s + r.tx_count, 0);
    expect(totalTx).toBeGreaterThanOrEqual(1);
    expect(totalRevenue).toBeGreaterThanOrEqual(9000);
  });
});
