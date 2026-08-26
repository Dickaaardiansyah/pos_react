const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("journalService.getCurrentBalance", () => {
  test("0 jika akun belum ada mutasi", async () => {
    await seedSystemAccounts();
    const bal = await journalService.getCurrentBalance("1100");
    expect(bal).toBe(0);
  });

  test("0 jika kode akun tidak ada", async () => {
    const bal = await journalService.getCurrentBalance("9999");
    expect(bal).toBe(0);
  });

  test("naik setelah debit Kas", async () => {
    await seedSystemAccounts();
    await journalService.postManualEntry(
      {
        entry_date: today(),
        lines: [
          { account_code: "1100", debit: 150000 },
          { account_code: "3100", credit: 150000 },
        ],
      },
      admin,
    );
    const bal = await journalService.getCurrentBalance("1100", today());
    expect(bal).toBe(150000);
  });
});
