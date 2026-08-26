// tests/services/cashRegisterService/getActiveShift.test.js
// INTEGRATION — cashRegisterService.getActiveShift
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const { seedRegisterOnly } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const kasir = { id: 2, name: "Kasir Test" };
const admin = { id: 1, name: "Admin Test" };

describe("cashRegisterService.getActiveShift", () => {
  test("null jika belum ada sesi open", async () => {
    await seedRegisterOnly();
    const shift = await cashRegisterService.getActiveShift(kasir);
    expect(shift).toBeNull();
  });

  test("mengembalikan sesi milik user + is_owner true", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 100000 },
      kasir,
    );
    const active = await cashRegisterService.getActiveShift(kasir);
    expect(active).not.toBeNull();
    expect(active.id).toBe(opened.id);
    expect(active.is_owner).toBe(true);
    expect(Number(active.expected_balance)).toBe(100000);
  });

  test("user lain tidak melihat sesi kasir (null)", async () => {
    await seedRegisterOnly();
    await cashRegisterService.openShift({ opening_balance: 100000 }, kasir);
    const active = await cashRegisterService.getActiveShift(admin);
    expect(active).toBeNull();
  });
});
