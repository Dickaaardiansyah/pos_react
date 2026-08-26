const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { ValidationError } = require("../../../services/productService");
const {
  seedSystemAccounts,
  getEntry,
  getLines,
  today,
} = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("journalService.postManualEntry", () => {
  test("menolak tanpa tanggal", async () => {
    await seedSystemAccounts();
    await expect(
      journalService.postManualEntry(
        {
          lines: [
            { account_code: "1100", debit: 1000 },
            { account_code: "3100", credit: 1000 },
          ],
        },
        admin,
      ),
    ).rejects.toThrow("Tanggal jurnal wajib diisi");
  });

  test("menolak kurang dari 2 baris", async () => {
    await seedSystemAccounts();
    await expect(
      journalService.postManualEntry(
        {
          entry_date: today(),
          lines: [{ account_code: "1100", debit: 1000 }],
        },
        admin,
      ),
    ).rejects.toThrow(/minimal harus punya 2 baris/i);
  });

  test("menolak jurnal tidak balance", async () => {
    await seedSystemAccounts();
    await expect(
      journalService.postManualEntry(
        {
          entry_date: today(),
          lines: [
            { account_code: "1100", debit: 1000 },
            { account_code: "3100", credit: 500 },
          ],
        },
        admin,
      ),
    ).rejects.toThrow(/tidak balance/i);
  });

  test("menolak debit & kredit pada baris yang sama", async () => {
    await seedSystemAccounts();
    await expect(
      journalService.postManualEntry(
        {
          entry_date: today(),
          lines: [
            { account_code: "1100", debit: 1000, credit: 1000 },
            { account_code: "3100", credit: 1000 },
          ],
        },
        admin,
      ),
    ).rejects.toThrow(/debit dan kredit sekaligus/i);
  });

  test("menolak nilai negatif", async () => {
    await seedSystemAccounts();
    await expect(
      journalService.postManualEntry(
        {
          entry_date: today(),
          lines: [
            { account_code: "1100", debit: -1000 },
            { account_code: "3100", credit: -1000 },
          ],
        },
        admin,
      ),
    ).rejects.toThrow(/tidak boleh bernilai negatif/i);
  });

  test("berhasil post jurnal balance: status posted, source manual", async () => {
    await seedSystemAccounts();
    const entry = await journalService.postManualEntry(
      {
        entry_date: today(),
        description: "Setoran modal manual",
        lines: [
          { account_code: "1100", debit: 500000, description: "Kas" },
          { account_code: "3100", credit: 500000, description: "Modal" },
        ],
      },
      admin,
    );

    expect(entry.id).toBeGreaterThan(0);
    expect(entry.entry_code).toBeTruthy();
    expect(entry.source).toBe("manual");
    expect(entry.status).toBe("posted");
    expect(Number(entry.total_debit)).toBe(500000);
    expect(Number(entry.total_credit)).toBe(500000);
    expect(entry.created_by).toBe("Admin Test");

    const lines = await getLines(entry.id);
    expect(lines).toHaveLength(2);

    const row = await getEntry(entry.id);
    expect(row.status).toBe("posted");
  });

  test("menolak akun tidak dikenal", async () => {
    await seedSystemAccounts();
    await expect(
      journalService.postManualEntry(
        {
          entry_date: today(),
          lines: [
            { account_code: "9999", debit: 1000 },
            { account_code: "3100", credit: 1000 },
          ],
        },
        admin,
      ),
    ).rejects.toThrow();
  });
});
