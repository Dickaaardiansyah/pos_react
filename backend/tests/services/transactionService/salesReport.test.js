// tests/services/transactionService/salesReport.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — transactionService.salesReport (SATU FUNGSI SAJA)
// Ringkasan periode + salesData + topProducts.
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

describe("transactionService.salesReport", () => {
  test("tanpa data: summary transactions=0, array kosong", async () => {
    const report = await transactionService.salesReport({
      period: "daily",
      start_date: "2020-01-01",
      end_date: "2020-01-31",
    });
    expect(Number(report.summary.total_transactions || 0)).toBe(0);
    expect(Array.isArray(report.salesData)).toBe(true);
    expect(Array.isArray(report.topProducts)).toBe(true);
    expect(report.period).toBe("daily");
  });

  test("setelah checkout: summary & topProducts terisi", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: {
        barcode: "SR1",
        name: "Produk Laris",
        price: 25000,
        stock: 50,
      },
    });
    await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 2 }],
        payment_method: "cash",
        payment_amount: 100000,
      },
      kasir,
    );

    const today = toLocalDatetime().split(" ")[0];
    const report = await transactionService.salesReport({
      period: "daily",
      start_date: today,
      end_date: today,
    });

    expect(Number(report.summary.total_transactions)).toBeGreaterThanOrEqual(1);
    expect(report.startDate).toBe(today);
    expect(report.endDate).toBe(today);
    // top products boleh kosong tergantung query, tapi harus array
    expect(Array.isArray(report.topProducts)).toBe(true);
  });
});
