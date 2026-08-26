const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("journalService.list", () => {
  test("kosong: data=[], total=0", async () => {
    const result = await journalService.list({});
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("setelah post: muncul di list", async () => {
    await seedSystemAccounts();
    const entry = await journalService.postManualEntry(
      {
        entry_date: today(),
        lines: [
          { account_code: "1100", debit: 3000 },
          { account_code: "3100", credit: 3000 },
        ],
      },
      admin,
    );
    const result = await journalService.list({});
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.data.find((r) => r.id === entry.id)).toBeDefined();
  });
});
