const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const accountingService = require("../../../services/accountingService");
const {
  NotFoundError,
} = require("../../../services/productService");
const { seedKasBalance, getExpense, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("accountingService.updateExpense", () => {
  test("NotFoundError jika id tidak ada", async () => {
    await expect(
      accountingService.updateExpense(999999, { amount: 1 }),
    ).rejects.toThrow(NotFoundError);
  });

  test("berhasil update deskripsi/kategori/amount", async () => {
    await seedKasBalance(500000);
    const exp = await accountingService.createExpense(
      {
        expense_date: today(),
        category: "sewa",
        description: "Sewa lama",
        amount: 100000,
        payment_source: "kantor",
      },
      admin,
    );

    const updated = await accountingService.updateExpense(exp.id, {
      expense_date: today(),
      category: "sewa",
      description: "Sewa baru",
      amount: 120000,
    });
    expect(updated.description).toMatch(/Sewa baru/);
    expect(Number(updated.amount)).toBe(120000);

    const row = await getExpense(exp.id);
    expect(Number(row.amount)).toBe(120000);
  });
});
