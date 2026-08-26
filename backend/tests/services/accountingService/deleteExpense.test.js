const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const accountingService = require("../../../services/accountingService");
const { NotFoundError } = require("../../../services/productService");
const { seedKasBalance, getExpense, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("accountingService.deleteExpense", () => {
  test("NotFoundError jika id tidak ada", async () => {
    await expect(accountingService.deleteExpense(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("berhasil hapus expense", async () => {
    await seedKasBalance(300000);
    const exp = await accountingService.createExpense(
      {
        expense_date: today(),
        category: "lainnya",
        amount: 15000,
        payment_source: "kantor",
      },
      admin,
    );
    await accountingService.deleteExpense(exp.id);
    expect(await getExpense(exp.id)).toBeNull();
  });
});
