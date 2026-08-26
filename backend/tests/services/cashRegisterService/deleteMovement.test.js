// tests/services/cashRegisterService/deleteMovement.test.js
// INTEGRATION — cashRegisterService.deleteMovement
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const {
  ValidationError,
  NotFoundError,
} = require("../../../services/productService");
const { seedRegisterOnly, getMovements } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const kasir = { id: 2, name: "Kasir Test" };

describe("cashRegisterService.deleteMovement", () => {
  test("melempar NotFoundError jika movement tidak ada", async () => {
    await seedRegisterOnly();
    await expect(
      cashRegisterService.deleteMovement(999999, kasir),
    ).rejects.toThrow(NotFoundError);
  });

  test("berhasil hapus movement pada shift open: saldo kembali", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 100000 },
      kasir,
    );
    await cashRegisterService.createMovement(
      { type: "out", category: "lainnya", amount: 20000 },
      kasir,
    );
    const movements = await getMovements(opened.id);
    expect(movements).toHaveLength(1);

    const after = await cashRegisterService.deleteMovement(
      movements[0].id,
      kasir,
    );
    expect(Number(after.expected_balance)).toBe(100000);
    expect(await getMovements(opened.id)).toHaveLength(0);
  });

  test("menolak hapus movement jika shift sudah ditutup", async () => {
    await seedRegisterOnly();
    const opened = await cashRegisterService.openShift(
      { opening_balance: 100000 },
      kasir,
    );
    await cashRegisterService.createMovement(
      { type: "in", category: "lainnya", amount: 5000 },
      kasir,
    );
    const movements = await getMovements(opened.id);
    await cashRegisterService.closeShift(
      opened.id,
      { closing_balance_physical: 105000 },
      kasir,
    );

    await expect(
      cashRegisterService.deleteMovement(movements[0].id, kasir),
    ).rejects.toThrow(/masih terbuka/i);
  });
});
