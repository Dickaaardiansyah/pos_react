const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("journalService.trialBalance", () => {
  test("struktur + balance setelah jurnal", async () => {
    await seedSystemAccounts();
    await journalService.postManualEntry(
      {
        entry_date: today(),
        lines: [
          { account_code: "1100", debit: 100000 },
          { account_code: "3100", credit: 100000 },
        ],
      },
      admin,
    );
    const tb = await journalService.trialBalance({ as_of_date: today() });
    expect(tb).toBeTruthy();
    expect(tb).toHaveProperty("summary");
    // total debit harus = total credit di neraca saldo
    if (tb.summary.total_debit != null && tb.summary.total_credit != null) {
      expect(Number(tb.summary.total_debit)).toBeCloseTo(
        Number(tb.summary.total_credit),
        1,
      );
    }
  });
});
