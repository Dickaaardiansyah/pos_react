// tests/services/receivableService/aging.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const receivableService = require("../../../services/receivableService");
const { insertReceivable } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("receivableService.aging", () => {
  test("mengembalikan aging report", async () => {
    await insertReceivable({ amount: 20000, dueDays: 7 });
    const report = await receivableService.aging();
    expect(report).toBeTruthy();
  });
});
