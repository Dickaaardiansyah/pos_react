const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { NotFoundError } = require("../../../services/productService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("journalService.getEntryDetail", () => {
  test("NotFoundError jika tidak ada", async () => {
    await expect(journalService.getEntryDetail(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("header + lines", async () => {
    await seedSystemAccounts();
    const entry = await journalService.postManualEntry(
      {
        entry_date: today(),
        description: "Detail test",
        lines: [
          { account_code: "1100", debit: 1000 },
          { account_code: "3100", credit: 1000 },
        ],
      },
      admin,
    );
    const detail = await journalService.getEntryDetail(entry.id);
    expect(detail.id).toBe(entry.id);
    expect(Array.isArray(detail.lines)).toBe(true);
    expect(detail.lines).toHaveLength(2);
  });
});
