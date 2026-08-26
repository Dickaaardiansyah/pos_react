const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const {
  ValidationError,
  NotFoundError,
} = require("../../../services/productService");
const { seedSystemAccounts, getAccountByCode } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("journalService.updateAccount", () => {
  test("NotFoundError jika id tidak ada", async () => {
    await expect(
      journalService.updateAccount(999999, { account_name: "X" }),
    ).rejects.toThrow(NotFoundError);
  });

  test("berhasil ubah nama akun non-system", async () => {
    const acc = await journalService.createAccount({
      account_code: "1800",
      account_name: "Inventaris Lama",
      account_type: "aset",
      normal_balance: "debit",
    });
    const updated = await journalService.updateAccount(acc.id, {
      account_name: "Inventaris Baru",
    });
    expect(updated.account_name).toBe("Inventaris Baru");
  });

  test("menolak nonaktifkan akun sistem", async () => {
    await seedSystemAccounts();
    const kas = await getAccountByCode("1100");
    await expect(
      journalService.updateAccount(kas.id, { is_active: false }),
    ).rejects.toThrow(ValidationError);
  });
});
