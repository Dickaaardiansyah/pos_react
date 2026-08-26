const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
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

describe("journalService.deleteEntry", () => {
  test("NotFoundError jika tidak ada", async () => {
    await expect(journalService.deleteEntry(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("menolak hapus jurnal yang sudah posted", async () => {
    await seedSystemAccounts();
    const entry = await journalService.postManualEntry(
      {
        entry_date: today(),
        lines: [
          { account_code: "1100", debit: 10000 },
          { account_code: "3100", credit: 10000 },
        ],
      },
      admin,
    );
    await expect(journalService.deleteEntry(entry.id)).rejects.toThrow(
      /sudah diposting|jurnal pembalik/i,
    );
    expect(await getEntry(entry.id)).not.toBeNull();
  });

  test("berhasil hapus jurnal draft manual", async () => {
    await seedSystemAccounts();
    const entry = await journalService.postManualEntry(
      {
        entry_date: today(),
        lines: [
          { account_code: "1100", debit: 10000 },
          { account_code: "3100", credit: 10000 },
        ],
      },
      admin,
    );
    // force draft (status default posted)
    const pool = getPool();
    await pool.query(
      "UPDATE journal_entries SET status = 'draft' WHERE id = ?",
      [entry.id],
    );

    await journalService.deleteEntry(entry.id);
    expect(await getEntry(entry.id)).toBeNull();
  });
});
