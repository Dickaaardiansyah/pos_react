// tests/services/cashRegisterService/getShiftDetail.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const { NotFoundError } = require("../../../services/productService");
const { seedRegisterOnly } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const kasir = { id: 2, name: "Kasir Test" };

describe("cashRegisterService.getShiftDetail", () => {
  test("melempar NotFoundError jika tidak ada", async () => {
    await expect(cashRegisterService.getShiftDetail(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("header + movements", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 50000 },
      kasir,
    );
    await cashRegisterService.createMovement(
      { type: "in", category: "lainnya", amount: 5000 },
      kasir,
    );

    const detail = await cashRegisterService.getShiftDetail(opened.id);
    expect(detail.id).toBe(opened.id);
    expect(Array.isArray(detail.movements)).toBe(true);
    expect(detail.movements).toHaveLength(1);
    expect(Number(detail.movements[0].amount)).toBe(5000);
  });
});
