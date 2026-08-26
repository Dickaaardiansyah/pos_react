// tests/services/cashRegisterService/report.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const { toLocalDatetime } = require("../../../services/transactionService");
const { seedRegisterOnly } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const kasir = { id: 2, name: "Kasir Test" };

describe("cashRegisterService.report", () => {
  test("tanpa data: cashIn/cashOut array, summary nol", async () => {
    const report = await cashRegisterService.report({
      start_date: "2020-01-01",
      end_date: "2020-01-31",
    });
    expect(Array.isArray(report.cashIn)).toBe(true);
    expect(Array.isArray(report.cashOut)).toBe(true);
    expect(report.summary.total_kas_masuk).toBe(0);
    expect(report.summary.total_kas_keluar).toBe(0);
  });

  test("setelah buka kas + cash out: masuk rekap", async () => {
    await seedRegisterOnly();
    await cashRegisterService.openShift({ opening_balance: 100000 }, kasir);
    await cashRegisterService.createMovement(
      { type: "out", category: "transportasi", amount: 10000 },
      kasir,
    );

    const today = toLocalDatetime().split(" ")[0];
    const report = await cashRegisterService.report({
      start_date: today,
      end_date: today,
    });

    expect(report.summary.total_kas_awal).toBeGreaterThanOrEqual(100000);
    expect(report.summary.total_kas_keluar).toBeGreaterThanOrEqual(10000);
    expect(report.cashIn.some((r) => r.kategori === "Kas Awal")).toBe(true);
  });
});
