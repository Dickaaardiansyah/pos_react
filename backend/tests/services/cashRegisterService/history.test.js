// tests/services/cashRegisterService/history.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const { seedRegisterOnly } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const kasir = { id: 2, name: "Kasir Test" };

describe("cashRegisterService.history", () => {
  test("kosong: data=[], total=0", async () => {
    const result = await cashRegisterService.history({});
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("setelah tutup shift: muncul di history", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 40000 },
      kasir,
    );
    await cashRegisterService.closeShift(
      opened.id,
      { closing_balance_physical: 40000 },
      kasir,
    );

    const result = await cashRegisterService.history({ limit: 20, page: 1 });
    expect(result.total).toBeGreaterThanOrEqual(1);
    const found = result.data.find((r) => r.id === opened.id);
    expect(found).toBeDefined();
  });
});
