// tests/services/payableService/unpaidInvoices.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const payableService = require("../../../services/payableService");
const {
  seedSystemAccounts,
  seedKasKantorBalance,
  futureDueDate,
} = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("payableService.unpaidInvoices", () => {
  test("tidak termasuk yang lunas", async () => {
    await seedSystemAccounts();
    const open = await payableService.create({
      supplier_name: "Open",
      amount: 10000,
      due_date: futureDueDate(),
    });
    const paid = await payableService.create({
      supplier_name: "Paid",
      amount: 5000,
      due_date: futureDueDate(),
    });
    await seedKasKantorBalance(100000);
    await payableService.recordPayment(
      paid.id,
      { amount: 5000, payment_source: "kantor" },
      admin,
    );

    const list = await payableService.unpaidInvoices();
    expect(list.find((r) => r.id === open.id)).toBeDefined();
    expect(list.find((r) => r.id === paid.id)).toBeUndefined();
  });
});
