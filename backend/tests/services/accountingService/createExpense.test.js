const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const accountingService = require("../../../services/accountingService");
const { ValidationError } = require("../../../services/productService");
const {
  seedSystemAccounts,
  seedKasBalance,
  seedRegisterAndShift,
  getExpense,
  today,
} = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("accountingService.createExpense", () => {
  test("menolak field wajib kosong", async () => {
    await expect(
      accountingService.createExpense({ category: "gaji" }, admin),
    ).rejects.toThrow(/wajib diisi/i);
  });

  test("menolak amount <= 0", async () => {
    await expect(
      accountingService.createExpense(
        { expense_date: today(), category: "gaji", amount: 0 },
        admin,
      ),
    ).rejects.toThrow("Jumlah biaya harus lebih dari 0");
  });

  test("kantor: ditolak jika saldo kas tidak cukup", async () => {
    await seedSystemAccounts();
    await expect(
      accountingService.createExpense(
        {
          expense_date: today(),
          category: "gaji",
          amount: 50000,
          payment_source: "kantor",
        },
        admin,
      ),
    ).rejects.toThrow(/tidak cukup/i);
  });

  test("kantor: sukses jika saldo cukup, shift_id null", async () => {
    await seedKasBalance(500000);
    const exp = await accountingService.createExpense(
      {
        expense_date: today(),
        category: "listrik_air",
        description: "PLN",
        amount: 75000,
        payment_source: "kantor",
      },
      admin,
    );
    expect(exp.id).toBeGreaterThan(0);
    expect(exp.category).toBe("listrik_air");
    expect(Number(exp.amount)).toBe(75000);
    expect(exp.shift_id).toBeNull();
    expect(exp.recorded_by).toBe("Admin Test");

    const row = await getExpense(exp.id);
    expect(row).not.toBeNull();
  });

  test("laci: ditolak tanpa shift open", async () => {
    await seedSystemAccounts();
    await expect(
      accountingService.createExpense(
        {
          expense_date: today(),
          category: "transportasi",
          amount: 10000,
          payment_source: "laci",
        },
        admin,
      ),
    ).rejects.toThrow(/Tidak ada sesi kas/i);
  });

  test("laci: sukses dengan shift, shift_id terisi", async () => {
    await seedSystemAccounts();
    const { shiftId } = await seedRegisterAndShift(2, 200000);
    const exp = await accountingService.createExpense(
      {
        expense_date: today(),
        category: "administrasi",
        amount: 25000,
        payment_source: "laci",
        shift_id: shiftId,
      },
      admin,
    );
    expect(Number(exp.shift_id)).toBe(shiftId);
  });

  test("laci: ditolak jika saldo laci kurang", async () => {
    await seedSystemAccounts();
    await seedRegisterAndShift(2, 5000);
    await expect(
      accountingService.createExpense(
        {
          expense_date: today(),
          category: "gaji",
          amount: 100000,
          payment_source: "laci",
        },
        admin,
      ),
    ).rejects.toThrow(/tidak cukup/i);
  });
});
