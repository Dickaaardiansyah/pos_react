const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const accountingService = require("../../../services/accountingService");
const { seedKasBalance, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("accountingService.listExpenses", () => {
  test("kosong jika belum ada", async () => {
    const list = await accountingService.listExpenses({});
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(0);
  });

  test("menampilkan expense yang dibuat", async () => {
    await seedKasBalance(200000);
    const exp = await accountingService.createExpense(
      {
        expense_date: today(),
        category: "pemasaran",
        amount: 30000,
        payment_source: "kantor",
      },
      admin,
    );
    const list = await accountingService.listExpenses({});
    expect(list.find((r) => r.id === exp.id)).toBeDefined();
  });
});
