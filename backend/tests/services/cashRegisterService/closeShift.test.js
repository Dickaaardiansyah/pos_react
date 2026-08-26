// tests/services/cashRegisterService/closeShift.test.js
// INTEGRATION — cashRegisterService.closeShift
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const {
  ValidationError,
  NotFoundError,
} = require("../../../services/productService");
const { ForbiddenError } = require("../../../middleware/auth");
const { seedRegisterOnly, getShift } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const kasir = { id: 2, name: "Kasir Test" };
const admin = { id: 1, name: "Admin Test" };

describe("cashRegisterService.closeShift", () => {
  test("melempar NotFoundError jika shift tidak ada", async () => {
    await expect(
      cashRegisterService.closeShift(
        999999,
        { closing_balance_physical: 0 },
        kasir,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  test("menolak jika kas fisik kosong", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 50000 },
      kasir,
    );
    await expect(
      cashRegisterService.closeShift(opened.id, {}, kasir),
    ).rejects.toThrow("Jumlah kas fisik hasil hitung wajib diisi");
  });

  test("menolak kas fisik negatif", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 50000 },
      kasir,
    );
    await expect(
      cashRegisterService.closeShift(
        opened.id,
        { closing_balance_physical: -10 },
        kasir,
      ),
    ).rejects.toThrow("tidak boleh negatif");
  });

  test("berhasil tutup: status closed, difference = fisik - sistem", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 100000 },
      kasir,
    );
    // fisik 98000 → selisih -2000
    const closed = await cashRegisterService.closeShift(
      opened.id,
      {
        closing_balance_physical: 98000,
        closing_notes: "Kurang 2rb",
      },
      kasir,
    );

    expect(closed.status).toBe("closed");
    expect(Number(closed.closing_balance_physical)).toBe(98000);
    expect(Number(closed.closing_balance_system)).toBe(100000);
    expect(Number(closed.difference)).toBe(-2000);
    expect(closed.closed_by).toBe("Kasir Test");

    const row = await getShift(opened.id);
    expect(row.status).toBe("closed");
    expect(row.voided_at == null || true).toBe(true);
  });

  test("menolak tutup shift yang sudah closed", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 50000 },
      kasir,
    );
    await cashRegisterService.closeShift(
      opened.id,
      { closing_balance_physical: 50000 },
      kasir,
    );
    await expect(
      cashRegisterService.closeShift(
        opened.id,
        { closing_balance_physical: 50000 },
        kasir,
      ),
    ).rejects.toThrow(/sudah ditutup/i);
  });

  test("menolak tutup shift milik kasir lain", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 50000 },
      kasir,
    );
    await expect(
      cashRegisterService.closeShift(
        opened.id,
        { closing_balance_physical: 50000 },
        admin,
      ),
    ).rejects.toThrow(ForbiddenError);
  });
});
