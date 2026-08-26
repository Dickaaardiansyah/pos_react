const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { NotFoundError } = require("../../../services/productService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("journalService.generalLedger", () => {
  test("NotFoundError jika akun tidak ada", async () => {
    await expect(
      journalService.generalLedger({ account_code: "9999" }),
    ).rejects.toThrow(NotFoundError);
  });

  test("opening/closing + mutations setelah post", async () => {
    await seedSystemAccounts();
    await journalService.postManualEntry(
      {
        entry_date: today(),
        lines: [
          { account_code: "1100", debit: 40000 },
          { account_code: "3100", credit: 40000 },
        ],
      },
      admin,
    );
    const gl = await journalService.generalLedger({
      account_code: "1100",
      start_date: today(),
      end_date: today(),
    });
    expect(gl.account.account_code).toBe("1100");
    expect(gl).toHaveProperty("opening_balance");
    expect(gl).toHaveProperty("closing_balance");
    expect(Array.isArray(gl.mutations)).toBe(true);
    expect(gl.closing_balance).toBe(40000);
  });
});
