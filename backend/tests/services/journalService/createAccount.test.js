const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const {
  ValidationError,
} = require("../../../services/productService");
const { getAccountByCode } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("journalService.createAccount", () => {
  test("menolak field wajib kosong", async () => {
    await expect(
      journalService.createAccount({ account_code: "9999" }),
    ).rejects.toThrow(ValidationError);
  });

  test("menolak tipe akun tidak valid", async () => {
    await expect(
      journalService.createAccount({
        account_code: "9991",
        account_name: "X",
        account_type: "invalid",
        normal_balance: "debit",
      }),
    ).rejects.toThrow("Tipe akun tidak valid");
  });

  test("menolak normal_balance tidak valid", async () => {
    await expect(
      journalService.createAccount({
        account_code: "9992",
        account_name: "X",
        account_type: "aset",
        normal_balance: "kiri",
      }),
    ).rejects.toThrow(/Saldo normal/i);
  });

  test("berhasil buat akun baru", async () => {
    const acc = await journalService.createAccount({
      account_code: "1199",
      account_name: "Kas Kecil Manual",
      account_type: "aset",
      normal_balance: "debit",
      description: "Test",
    });
    expect(acc.account_code).toBe("1199");
    expect(acc.account_name).toBe("Kas Kecil Manual");
    expect(Number(acc.is_active)).toBe(1);

    const row = await getAccountByCode("1199");
    expect(row).not.toBeNull();
  });

  test("menolak kode akun duplikat", async () => {
    await journalService.createAccount({
      account_code: "1198",
      account_name: "A",
      account_type: "aset",
      normal_balance: "debit",
    });
    await expect(
      journalService.createAccount({
        account_code: "1198",
        account_name: "B",
        account_type: "aset",
        normal_balance: "debit",
      }),
    ).rejects.toThrow("Kode akun sudah digunakan");
  });
});
