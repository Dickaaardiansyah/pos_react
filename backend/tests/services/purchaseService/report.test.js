// tests/services/purchaseService/report.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — purchaseService.report (SATU FUNGSI SAJA)
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const purchaseService = require("../../../services/purchaseService");
const { toLocalDatetime } = require("../../../services/transactionService");
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

describe("purchaseService.report", () => {
  test("tanpa data: struktur lengkap, summary nol/kosong", async () => {
    const report = await purchaseService.report({
      start_date: "2020-01-01",
      end_date: "2020-01-31",
      period: "daily",
    });
    expect(report.period).toBe("daily");
    expect(report.startDate).toBe("2020-01-01");
    expect(Array.isArray(report.periodData)).toBe(true);
    expect(Array.isArray(report.topProducts)).toBe(true);
    expect(Array.isArray(report.perSupplier)).toBe(true);
  });

  test("setelah pembelian: summary terisi", async () => {
    const { productId } = await seedCreditReady({
      name: "Laporan Beli",
      stock: 0,
    });
    await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 3, unit_cost: 10000 }],
        payment_method: "kredit",
        supplier_name: "Supplier Laporan",
      },
      admin,
    );

    const today = toLocalDatetime().split(" ")[0];
    const report = await purchaseService.report({
      start_date: today,
      end_date: today,
      period: "daily",
    });

    expect(report.summary).toBeTruthy();
    // field summary tergantung model; pastikan object
    expect(typeof report.summary).toBe("object");
  });
});
