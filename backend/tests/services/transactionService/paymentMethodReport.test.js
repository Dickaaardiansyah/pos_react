// tests/services/transactionService/paymentMethodReport.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — transactionService.paymentMethodReport (SATU FUNGSI SAJA)
// Agregasi omzet per metode bayar + label lokal.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const {
  transactionService,
  toLocalDatetime,
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

describe("transactionService.paymentMethodReport", () => {
  test("tanpa data: data=[], summary nol", async () => {
    const report = await transactionService.paymentMethodReport({});
    expect(report.data).toEqual([]);
    expect(report.summary.total_transactions).toBe(0);
    expect(report.summary.total_amount).toBe(0);
  });

  test("setelah checkout cash: baris Tunai muncul", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "PMR1", name: "Metode", price: 10000, stock: 20 },
    });
    await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 1 }],
        payment_method: "cash",
        payment_amount: 10000,
      },
      kasir,
    );

    const today = toLocalDatetime().split(" ")[0];
    const report = await transactionService.paymentMethodReport({
      start_date: today,
      end_date: today,
    });

    expect(report.summary.total_transactions).toBeGreaterThanOrEqual(1);
    const cash = report.data.find((r) => r.payment_method === "cash");
    expect(cash).toBeDefined();
    expect(cash.payment_method_label).toBe("Tunai");
    expect(cash.transaction_count).toBeGreaterThanOrEqual(1);
    expect(cash.total_amount).toBeGreaterThanOrEqual(10000);
  });
});
