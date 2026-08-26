// tests/services/receivableService/unpaidInvoices.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const receivableService = require("../../../services/receivableService");
const {
  seedSystemAccounts,
  insertReceivable,
} = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test", role: "admin" };

describe("receivableService.unpaidInvoices", () => {
  test("tidak termasuk lunas / dibatalkan", async () => {
    await seedSystemAccounts();
    const openId = await insertReceivable({
      customerName: "Open",
      amount: 10000,
    });
    const paidId = await insertReceivable({
      customerName: "Paid",
      amount: 5000,
    });
    await receivableService.recordPayment(
      paidId,
      { amount: 5000 },
      admin,
    );
    await insertReceivable({
      customerName: "Void",
      amount: 3000,
      status: "dibatalkan",
    });

    const list = await receivableService.unpaidInvoices();
    expect(list.find((r) => r.id === openId)).toBeDefined();
    expect(list.find((r) => r.id === paidId)).toBeUndefined();
    expect(list.find((r) => r.status === "dibatalkan")).toBeUndefined();
  });
});
