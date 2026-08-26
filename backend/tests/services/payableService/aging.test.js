// tests/services/payableService/aging.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const payableService = require("../../../services/payableService");
const { seedSystemAccounts, futureDueDate } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("payableService.aging", () => {
  test("mengembalikan struktur aging report", async () => {
    await seedSystemAccounts();
    await payableService.create({
      supplier_name: "Aging Sup",
      amount: 20000,
      due_date: futureDueDate(7),
    });
    const report = await payableService.aging();
    expect(report).toBeTruthy();
  });
});
