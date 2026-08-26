// tests/services/cashRegisterService/listOpenShifts.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const { seedRegisterOnly } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const kasir = { id: 2, name: "Kasir Test" };

describe("cashRegisterService.listOpenShifts", () => {
  test("kosong jika tidak ada sesi open", async () => {
    await seedRegisterOnly();
    const list = await cashRegisterService.listOpenShifts();
    expect(list).toEqual([]);
  });

  test("menampilkan sesi open dengan expected_balance", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 75000 },
      kasir,
    );
    const list = await cashRegisterService.listOpenShifts();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(opened.id);
    expect(Number(list[0].expected_balance)).toBe(75000);
    expect(list[0].opened_by_user_id).toBe(2);
  });
});
