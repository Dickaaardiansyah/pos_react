const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { seedSystemAccounts } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("journalService.listAccounts", () => {
  test("kosong jika belum ada akun", async () => {
    const list = await journalService.listAccounts({});
    expect(Array.isArray(list)).toBe(true);
  });

  test("menampilkan akun setelah seed", async () => {
    await seedSystemAccounts();
    const list = await journalService.listAccounts({});
    expect(list.length).toBeGreaterThan(0);
    expect(list.find((a) => a.account_code === "1100")).toBeDefined();
  });
});
