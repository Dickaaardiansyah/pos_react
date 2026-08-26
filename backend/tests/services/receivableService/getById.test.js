// tests/services/receivableService/getById.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const receivableService = require("../../../services/receivableService");
const { NotFoundError } = require("../../../services/productService");
const {
  seedSystemAccounts,
  insertReceivable,
} = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test", role: "admin" };

describe("receivableService.getById", () => {
  test("melempar NotFoundError jika tidak ada", async () => {
    await expect(receivableService.getById(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("mengembalikan piutang + payments + items", async () => {
    await seedSystemAccounts();
    const id = await insertReceivable({
      customerName: "Detail Customer",
      amount: 80000,
    });
    await receivableService.recordPayment(
      id,
      { amount: 20000, payment_method: "cash" },
      admin,
    );

    const detail = await receivableService.getById(id);
    expect(detail.id).toBe(id);
    expect(detail.customer_name).toBe("Detail Customer");
    expect(Array.isArray(detail.payments)).toBe(true);
    expect(detail.payments).toHaveLength(1);
    expect(Array.isArray(detail.items)).toBe(true);
  });
});
