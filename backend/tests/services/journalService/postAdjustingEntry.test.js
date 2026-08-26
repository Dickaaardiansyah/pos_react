const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { ValidationError } = require("../../../services/productService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("journalService.listAdjustmentTemplates", () => {
  test("daftar template akrual", () => {
    const list = journalService.listAdjustmentTemplates();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("id");
    expect(list[0]).toHaveProperty("lines");
  });
});

describe("journalService.postAdjustingEntry", () => {
  test("menolak tanpa tanggal", async () => {
    await seedSystemAccounts();
    await expect(
      journalService.postAdjustingEntry(
        {
          lines: [
            { account_code: "5220", debit: 1000 },
            { account_code: "2110", credit: 1000 },
          ],
        },
        admin,
      ),
    ).rejects.toThrow("Tanggal jurnal wajib diisi");
  });

  test("berhasil post akrual gaji", async () => {
    await seedSystemAccounts();
    const entry = await journalService.postAdjustingEntry(
      {
        entry_date: today(),
        description: "Akrual gaji",
        template_id: "accrual_gaji",
        lines: [
          { account_code: "5220", debit: 50000 },
          { account_code: "2110", credit: 50000 },
        ],
      },
      admin,
    );
    expect(entry.reference_type).toBe("adjustment");
    expect(entry.source).toBe("manual");
    expect(entry.status).toBe("posted");
    expect(Number(entry.total_debit)).toBe(50000);
  });
});
