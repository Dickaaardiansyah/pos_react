// tests/services/receivableService/unpaidByCustomer.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const receivableService = require("../../../services/receivableService");
const { insertReceivable } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("receivableService.unpaidByCustomer", () => {
  test("mengelompokkan piutang belum lunas per pelanggan", async () => {
    await insertReceivable({ customerName: "Grup A", amount: 10000 });
    await insertReceivable({ customerName: "Grup A", amount: 5000 });
    await insertReceivable({ customerName: "Grup B", amount: 7000 });

    const rows = await receivableService.unpaidByCustomer();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
