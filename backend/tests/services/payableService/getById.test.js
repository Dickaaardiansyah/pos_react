// tests/services/payableService/getById.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const payableService = require("../../../services/payableService");
const { NotFoundError } = require("../../../services/productService");
const {
  seedSystemAccounts,
  seedKasKantorBalance,
  futureDueDate,
} = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("payableService.getById", () => {
  test("melempar NotFoundError jika tidak ada", async () => {
    await expect(payableService.getById(999999)).rejects.toThrow(NotFoundError);
  });

  test("mengembalikan hutang + payments + items", async () => {
    await seedSystemAccounts();
    const p = await payableService.create({
      supplier_name: "Detail Supplier",
      amount: 80000,
      due_date: futureDueDate(),
    });
    await seedKasKantorBalance(200000);
    await payableService.recordPayment(
      p.id,
      { amount: 20000, payment_source: "kantor" },
      admin,
    );

    const detail = await payableService.getById(p.id);
    expect(detail.id).toBe(p.id);
    expect(detail.supplier_name).toBe("Detail Supplier");
    expect(Array.isArray(detail.payments)).toBe(true);
    expect(detail.payments).toHaveLength(1);
    expect(Array.isArray(detail.items)).toBe(true);
  });
});
