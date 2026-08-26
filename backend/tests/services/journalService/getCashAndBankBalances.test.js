const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("journalService.getCashAndBankBalances", () => {
  test("mengembalikan { kas, bank }", async () => {
    await seedSystemAccounts();
    const bal = await journalService.getCashAndBankBalances(today());
    expect(bal).toHaveProperty("kas");
    expect(bal).toHaveProperty("bank");
    expect(bal.kas).toBe(0);
    expect(bal.bank).toBe(0);
  });

  test("kas naik setelah setoran", async () => {
    await seedSystemAccounts();
    await journalService.postManualEntry(
      {
        entry_date: today(),
        lines: [
          { account_code: "1100", debit: 80000 },
          { account_code: "3100", credit: 80000 },
        ],
      },
      admin,
    );
    const bal = await journalService.getCashAndBankBalances(today());
    expect(bal.kas).toBe(80000);
  });
});
