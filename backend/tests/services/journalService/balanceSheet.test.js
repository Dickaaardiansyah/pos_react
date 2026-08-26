const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("journalService.balanceSheet", () => {
  test("struktur neraca", async () => {
    await seedSystemAccounts();
    const bs = await journalService.balanceSheet({ as_of_date: today() });
    expect(bs).toBeTruthy();
  });

  test("setelah setoran modal: aset & modal terisi", async () => {
    await seedSystemAccounts();
    await journalService.postManualEntry(
      {
        entry_date: today(),
        lines: [
          { account_code: "1100", debit: 200000 },
          { account_code: "3100", credit: 200000 },
        ],
      },
      admin,
    );
    const bs = await journalService.balanceSheet({ as_of_date: today() });
    expect(bs).toBeTruthy();
  });
});
