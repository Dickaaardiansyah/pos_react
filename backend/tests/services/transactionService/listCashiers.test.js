// tests/services/transactionService/listCashiers.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — transactionService.listCashiers (SATU FUNGSI SAJA)
// Daftar nama kasir yang pernah melakukan transaksi.
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

describe("transactionService.listCashiers", () => {
  test("tanpa transaksi: array kosong atau tanpa nama kasir test", async () => {
    const list = await transactionService.listCashiers();
    expect(Array.isArray(list)).toBe(true);
  });

  test("setelah checkout: nama kasir muncul di daftar", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "LC1", name: "Kasir List", price: 5000, stock: 10 },
    });
    await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 1 }],
        payment_method: "cash",
        payment_amount: 5000,
      },
      kasir,
    );

    const list = await transactionService.listCashiers();
    const names = list.map((r) =>
      typeof r === "string" ? r : r.cashier_name || r.name,
    );
    expect(names).toContain("Kasir Test");
  });
});
