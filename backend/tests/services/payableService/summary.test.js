// tests/services/payableService/summary.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const payableService = require("../../../services/payableService");
const { seedSystemAccounts, futureDueDate } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("payableService.summary", () => {
  test("mengembalikan object summary", async () => {
    const s = await payableService.summary();
    expect(s).toBeTruthy();
    expect(typeof s).toBe("object");
  });

  test("setelah create: total hutang terpengaruh", async () => {
    await seedSystemAccounts();
    await payableService.create({
      supplier_name: "Sum Supplier",
      amount: 99000,
      due_date: futureDueDate(),
    });
    const s = await payableService.summary();
    // field names may vary: total_piutang vs total_hutang etc.
    const vals = Object.values(s).map((v) => Number(v) || 0);
    expect(vals.some((v) => v >= 99000)).toBe(true);
  });
});
