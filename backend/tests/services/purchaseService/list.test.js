// tests/services/purchaseService/list.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — purchaseService.list (SATU FUNGSI SAJA)
// Pagination daftar pembelian.
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

describe("purchaseService.list", () => {
  test("kosong: data=[], total=0", async () => {
    const result = await purchaseService.list({});
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
  });

  test("setelah recordPurchase: muncul di list", async () => {
    const { productId } = await seedCreditReady();
    const purchase = await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 2, unit_cost: 5000 }],
        payment_method: "kredit",
        supplier_name: "List Supplier",
      },
      admin,
    );

    const result = await purchaseService.list({ limit: 20, page: 1 });
    expect(result.total).toBeGreaterThanOrEqual(1);
    const found = result.data.find((r) => r.id === purchase.id);
    expect(found).toBeDefined();
    expect(found.purchase_code).toBe(purchase.purchase_code);
  });
});
