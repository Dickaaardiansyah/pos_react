// tests/services/receivableService/summary.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const receivableService = require("../../../services/receivableService");
const { insertReceivable } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("receivableService.summary", () => {
  test("object summary; total terpengaruh setelah seed", async () => {
    await insertReceivable({ amount: 99000 });
    const s = await receivableService.summary();
    expect(typeof s).toBe("object");
    const vals = Object.values(s).map((v) => Number(v) || 0);
    expect(vals.some((v) => v >= 99000)).toBe(true);
  });
});
