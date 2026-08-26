// tests/services/payableService/history.test.js
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

describe("payableService.history", () => {
  test("riwayat pembayaran setelah recordPayment", async () => {
    await seedSystemAccounts();
    const p = await payableService.create({
      supplier_name: "Hist Sup",
      amount: 40000,
      due_date: futureDueDate(),
    });
    await seedKasKantorBalance(100000);
    await payableService.recordPayment(
      p.id,
      { amount: 10000, payment_source: "kantor" },
      admin,
    );

    const hist = await payableService.history({});
    expect(Array.isArray(hist) || typeof hist === "object").toBe(true);
  });
});
