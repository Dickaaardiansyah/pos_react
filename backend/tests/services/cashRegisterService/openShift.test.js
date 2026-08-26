// tests/services/cashRegisterService/openShift.test.js
// INTEGRATION — cashRegisterService.openShift
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const { ValidationError } = require("../../../services/productService");
const { seedRegisterOnly, getShift } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const kasir = { id: 2, name: "Kasir Test" };
const admin = { id: 1, name: "Admin Test" };

describe("cashRegisterService.openShift", () => {
  test("menolak jika laci kas belum dikonfigurasi", async () => {
    await expect(
      cashRegisterService.openShift({ opening_balance: 100000 }, kasir),
    ).rejects.toThrow(/Laci kas belum dikonfigurasi/i);
  });

  test("menolak jika modal awal kosong", async () => {
    await seedRegisterOnly();
    await expect(
      cashRegisterService.openShift({}, kasir),
    ).rejects.toThrow("Modal awal kas wajib diisi");
  });

  test("menolak modal awal negatif", async () => {
    await seedRegisterOnly();
    await expect(
      cashRegisterService.openShift({ opening_balance: -1 }, kasir),
    ).rejects.toThrow("tidak boleh negatif");
  });

  test("berhasil buka sesi: status open, owner dari token, expected_balance = modal", async () => {
    await seedRegisterOnly();
    const shift = await cashRegisterService.openShift(
      { opening_balance: 150000, opening_notes: "Modal pagi" },
      kasir,
    );

    expect(shift.id).toBeGreaterThan(0);
    expect(shift.shift_code).toMatch(/^KAS/);
    expect(shift.status).toBe("open");
    expect(Number(shift.opening_balance)).toBe(150000);
    expect(Number(shift.expected_balance)).toBe(150000);
    expect(shift.opened_by).toBe("Kasir Test");
    expect(Number(shift.opened_by_user_id)).toBe(2);

    const row = await getShift(shift.id);
    expect(row.status).toBe("open");
    expect(Number(row.opened_by_user_id)).toBe(2);
  });

  test("menolak buka sesi kedua jika masih punya shift open", async () => {
    await seedRegisterOnly();
    await cashRegisterService.openShift({ opening_balance: 50000 }, kasir);
    await expect(
      cashRegisterService.openShift({ opening_balance: 50000 }, kasir),
    ).rejects.toThrow(/masih memiliki sesi kas yang terbuka/i);
  });

  test("menolak buka sesi jika laci dipegang kasir lain", async () => {
    await seedRegisterOnly();
    await cashRegisterService.openShift({ opening_balance: 50000 }, kasir);
    await expect(
      cashRegisterService.openShift({ opening_balance: 50000 }, admin),
    ).rejects.toThrow(/sedang dipegang oleh kasir lain/i);
  });
});
