// tests/services/cashRegisterService/getOpenShiftById.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const { seedRegisterOnly } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const kasir = { id: 2, name: "Kasir Test" };

describe("cashRegisterService.getOpenShiftById", () => {
  test("null jika id tidak ada", async () => {
    expect(await cashRegisterService.getOpenShiftById(999999)).toBeNull();
  });

  test("null jika shift sudah closed", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 10000 },
      kasir,
    );
    await cashRegisterService.closeShift(
      opened.id,
      { closing_balance_physical: 10000 },
      kasir,
    );
    expect(await cashRegisterService.getOpenShiftById(opened.id)).toBeNull();
  });

  test("mengembalikan summary jika masih open", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 30000 },
      kasir,
    );
    const found = await cashRegisterService.getOpenShiftById(opened.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(opened.id);
    expect(Number(found.expected_balance)).toBe(30000);
  });
});
