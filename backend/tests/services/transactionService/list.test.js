// tests/services/transactionService/list.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — transactionService.list (SATU FUNGSI SAJA)
// Pagination + filter tanggal/status/metode; Open Bill tidak muncul di list.
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

async function checkoutCash(qty = 1) {
  const { productId } = await seedCheckoutReady({
    userId: kasir.id,
    product: {
      barcode: `LS-${Date.now()}-${Math.random()}`,
      name: "List Item",
      price: 10000,
      stock: 100,
    },
  });
  return transactionService.checkout(
    {
      items: [{ product_id: productId, quantity: qty }],
      payment_method: "cash",
      payment_amount: 10000 * qty + 5000,
    },
    kasir,
  );
}

describe("transactionService.list", () => {
  test("kosong: data=[], total=0", async () => {
    const result = await transactionService.list({});
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
  });

  test("setelah checkout cash: muncul di list dengan pagination meta", async () => {
    const sale = await checkoutCash(1);
    const result = await transactionService.list({ limit: 10, page: 1 });

    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);

    const found = result.data.find((r) => r.id === sale.id);
    expect(found).toBeDefined();
    expect(found.transaction_code).toBe(sale.transaction_code);
  });

  test("Open Bill tidak muncul di list riwayat (hanya di piutang)", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "OB-LIST", name: "Open Bill", price: 5000, stock: 10 },
    });
    const sale = await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 1 }],
        payment_method: "open_bill",
        customer_name: "Pelanggan OB",
        payment_amount: 0,
      },
      kasir,
    );

    const result = await transactionService.list({});
    const found = result.data.find((r) => r.id === sale.id);
    expect(found).toBeUndefined();
  });

  test("filter status=cancelled menampilkan transaksi void", async () => {
    const sale = await checkoutCash(1);
    await transactionService.voidTransaction(sale.id, {
      reason: "Tes filter",
      voided_by: "Admin",
      adminUserId: 1,
    });

    const completed = await transactionService.list({ status: "completed" });
    expect(completed.data.find((r) => r.id === sale.id)).toBeUndefined();

    const cancelled = await transactionService.list({ status: "cancelled" });
    expect(cancelled.data.find((r) => r.id === sale.id)).toBeDefined();
  });
});
