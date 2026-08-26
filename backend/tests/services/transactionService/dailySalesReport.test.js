// tests/services/transactionService/dailySalesReport.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — transactionService.dailySalesReport (SATU FUNGSI SAJA)
// Ringkasan + daftar transaksi pada satu tanggal.
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

describe("transactionService.dailySalesReport", () => {
  test("tanpa transaksi: summary nol, transactions=[]", async () => {
    const report = await transactionService.dailySalesReport({});
    expect(report.summary.total_transactions).toBe(0);
    expect(report.summary.net_sales).toBe(0);
    expect(report.transactions).toEqual([]);
    expect(report.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("setelah checkout hari ini: masuk ringkasan & daftar", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "DSR1", name: "Harian", price: 15000, stock: 10 },
    });
    const sale = await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 2 }],
        payment_method: "cash",
        payment_amount: 50000,
      },
      kasir,
    );

    const today = toLocalDatetime().split(" ")[0];
    const report = await transactionService.dailySalesReport({ date: today });

    expect(report.date).toBe(today);
    expect(report.summary.total_transactions).toBeGreaterThanOrEqual(1);
    expect(report.summary.net_sales).toBeGreaterThanOrEqual(30000);

    const row = report.transactions.find((t) => t.id === sale.id);
    expect(row).toBeDefined();
    expect(row.payment_method_label).toBe("Tunai");
    expect(row.status_label).toBe("Selesai");
    expect(row.payment_status).toBe("Lunas");
    expect(row.total).toBe(30000);
  });

  test("tanggal tanpa data: kosong", async () => {
    const report = await transactionService.dailySalesReport({
      date: "2020-01-01",
    });
    expect(report.summary.total_transactions).toBe(0);
    expect(report.transactions).toEqual([]);
  });
});
