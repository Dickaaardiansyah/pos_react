// tests/services/transactionService/voidReport.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — transactionService.voidReport (SATU FUNGSI SAJA)
// Daftar transaksi yang dibatalkan + ringkasan.
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

describe("transactionService.voidReport", () => {
  test("tanpa void: data kosong, total_void=0", async () => {
    const report = await transactionService.voidReport({});
    expect(report.data).toEqual([]);
    expect(report.summary.total_void).toBe(0);
  });

  test("setelah void: muncul di laporan dengan alasan & voided_by", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "VR1", name: "Void Report", price: 7000, stock: 15 },
    });
    const sale = await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 1 }],
        payment_method: "cash",
        payment_amount: 10000,
      },
      kasir,
    );
    await transactionService.voidTransaction(sale.id, {
      reason: "Salah barcode",
      voided_by: "Admin Test",
      adminUserId: 1,
    });

    const today = toLocalDatetime().split(" ")[0];
    const report = await transactionService.voidReport({
      start_date: today,
      end_date: today,
    });

    expect(report.summary.total_void).toBeGreaterThanOrEqual(1);
    const row = report.data.find((r) => r.id === sale.id);
    expect(row).toBeDefined();
    expect(row.void_reason).toBe("Salah barcode");
    expect(row.voided_by).toBe("Admin Test");
    expect(row.transaction_code).toBe(sale.transaction_code);
  });
});
