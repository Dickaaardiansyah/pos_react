const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const accountingService = require("../../../services/accountingService");
const { seedSystemAccounts, seedKasBalance, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("accountingService.incomeStatement", () => {
  test("struktur laporan lengkap (tanpa transaksi)", async () => {
    await seedSystemAccounts();
    const stmt = await accountingService.incomeStatement({});
    expect(stmt).toHaveProperty("period");
    expect(stmt.period).toHaveProperty("startDate");
    expect(stmt.period).toHaveProperty("endDate");
    expect(stmt).toHaveProperty("revenue");
    expect(stmt.revenue).toHaveProperty("net_sales");
    expect(stmt).toHaveProperty("cost_of_goods_sold");
    expect(stmt).toHaveProperty("gross_profit");
    expect(stmt).toHaveProperty("operating_expenses");
    expect(stmt.operating_expenses).toHaveProperty("total");
    expect(stmt).toHaveProperty("operating_profit");
    expect(stmt).toHaveProperty("profit_before_tax");
    expect(stmt).toHaveProperty("net_profit");
    expect(stmt).toHaveProperty("ratios");
    expect(stmt).toHaveProperty("ratios");
  });

  test("setelah createExpense: operating_expenses.total naik", async () => {
    await seedKasBalance(500000);
    await accountingService.createExpense(
      {
        expense_date: today(),
        category: "gaji",
        amount: 100000,
        payment_source: "kantor",
      },
      admin,
    );
    const t = today();
    const stmt = await accountingService.incomeStatement({
      start_date: t,
      end_date: t,
    });
    expect(Number(stmt.operating_expenses.total)).toBeGreaterThanOrEqual(
      100000,
    );
  });
});
