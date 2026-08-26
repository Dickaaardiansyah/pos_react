// tests/services/purchaseService/dashboard.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — purchaseService.dashboard (SATU FUNGSI SAJA)
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const purchaseService = require("../../../services/purchaseService");
const { seedCreditReady } = require("./helpers");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

const admin = { id: 1, name: "Admin Test" };

describe("purchaseService.dashboard", () => {
  test("tanpa data: struktur thisMonth/lastMonth/recentPurchases/topProductsMonth", async () => {
    const dash = await purchaseService.dashboard();
    expect(dash).toHaveProperty("thisMonth");
    expect(dash).toHaveProperty("lastMonth");
    expect(dash).toHaveProperty("recentPurchases");
    expect(dash).toHaveProperty("topProductsMonth");
  });

  test("setelah pembelian bulan ini: recentPurchases tidak kosong", async () => {
    const { productId } = await seedCreditReady({ stock: 0 });
    await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 1, unit_cost: 5000 }],
        payment_method: "kredit",
        supplier_name: "Dashboard Supplier",
      },
      admin,
    );

    const dash = await purchaseService.dashboard();
    expect(Array.isArray(dash.recentPurchases)).toBe(true);
    expect(dash.recentPurchases.length).toBeGreaterThanOrEqual(1);
  });
});
