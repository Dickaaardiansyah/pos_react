// tests/services/receivableService/history.test.js
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

describe("receivableService.history", () => {
  test("riwayat setelah recordPayment", async () => {
    await seedSystemAccounts();
    const id = await insertReceivable({ amount: 40000 });
    await receivableService.recordPayment(id, { amount: 10000 }, admin);

    const hist = await receivableService.history({});
    expect(hist).toBeTruthy();
  });
});
