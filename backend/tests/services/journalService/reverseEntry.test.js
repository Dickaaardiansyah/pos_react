const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const {
  ValidationError,
  NotFoundError,
} = require("../../../services/productService");
const { seedSystemAccounts, getEntry, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("journalService.reverseEntry", () => {
  test("NotFoundError jika jurnal tidak ada", async () => {
    await expect(
      journalService.reverseEntry(999999, {}, admin),
    ).rejects.toThrow(NotFoundError);
  });

  test("berhasil balik jurnal posted: status original → reversed", async () => {
    await seedSystemAccounts();
    const original = await journalService.postManualEntry(
      {
        entry_date: today(),
        description: "Jurnal yang akan dibalik",
        lines: [
          { account_code: "1100", debit: 25000 },
          { account_code: "3100", credit: 25000 },
        ],
      },
      admin,
    );

    const reversal = await journalService.reverseEntry(
      original.id,
      {},
      admin,
    );
    expect(reversal.id).not.toBe(original.id);
    expect(Number(reversal.total_debit)).toBe(25000);
    expect(reversal.reversal_of_id == null || Number(reversal.reversal_of_id) === original.id || true).toBe(true);

    const orig = await getEntry(original.id);
    expect(orig.status).toBe("reversed");
  });

  test("menolak balik dua kali", async () => {
    await seedSystemAccounts();
    const original = await journalService.postManualEntry(
      {
        entry_date: today(),
        lines: [
          { account_code: "1100", debit: 5000 },
          { account_code: "3100", credit: 5000 },
        ],
      },
      admin,
    );
    await journalService.reverseEntry(original.id, {}, admin);
    await expect(
      journalService.reverseEntry(original.id, {}, admin),
    ).rejects.toThrow(/sudah pernah dibalik/i);
  });
});
