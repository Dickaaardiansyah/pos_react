const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const accountingService = require("../../../services/accountingService");
const { ValidationError } = require("../../../services/productService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("accountingService — varian laporan laba rugi", () => {
  test("multiYearIncomeStatement mengembalikan data", async () => {
    await seedSystemAccounts();
    const year = new Date().getFullYear();
    const result = await accountingService.multiYearIncomeStatement({
      end_year: year,
      years: 2,
    });
    expect(result).toBeTruthy();
  });

  test("quarterlyIncomeStatement mengembalikan data", async () => {
    await seedSystemAccounts();
    const year = new Date().getFullYear();
    const result = await accountingService.quarterlyIncomeStatement({ year });
    expect(result).toBeTruthy();
  });

  test("multiPeriodIncomeStatement mengembalikan data", async () => {
    await seedSystemAccounts();
    const t = today();
    const result = await accountingService.multiPeriodIncomeStatement({
      start_date: t,
      end_date: t,
    });
    expect(result).toBeTruthy();
  });

  test("comparisonIncomeStatement menolak periode tidak lengkap", async () => {
    await expect(
      accountingService.comparisonIncomeStatement({}),
    ).rejects.toThrow(ValidationError);
  });

  test("comparisonIncomeStatement dengan 2 periode", async () => {
    await seedSystemAccounts();
    const t = today();
    const result = await accountingService.comparisonIncomeStatement({
      period1_start: t,
      period1_end: t,
      period2_start: t,
      period2_end: t,
    });
    expect(result).toBeTruthy();
  });

  test("monthlyTrend mengembalikan data", async () => {
    await seedSystemAccounts();
    const result = await accountingService.monthlyTrend();
    expect(result).toBeTruthy();
  });
});
