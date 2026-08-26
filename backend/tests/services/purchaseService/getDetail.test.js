// tests/services/purchaseService/getDetail.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — purchaseService.getDetail (SATU FUNGSI SAJA)
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const purchaseService = require("../../../services/purchaseService");
const { NotFoundError } = require("../../../services/productService");
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

describe("purchaseService.getDetail", () => {
  test("melempar NotFoundError jika id tidak ada", async () => {
    await expect(purchaseService.getDetail(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("mengembalikan header + items", async () => {
    const { productId } = await seedCreditReady({
      name: "Item Detail",
      stock: 0,
    });
    const purchase = await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 4, unit_cost: 2500 }],
        payment_method: "kredit",
        supplier_name: "Detail Supplier",
        notes: "Nota test",
      },
      admin,
    );

    const detail = await purchaseService.getDetail(purchase.id);
    expect(detail.id).toBe(purchase.id);
    expect(detail.supplier_name).toBe("Detail Supplier");
    expect(detail.notes).toBe("Nota test");
    expect(Array.isArray(detail.items)).toBe(true);
    expect(detail.items).toHaveLength(1);
    expect(Number(detail.items[0].quantity)).toBe(4);
    expect(Number(detail.items[0].unit_cost)).toBe(2500);
  });
});
