// tests/services/cashRegisterService/createMovement.test.js
// INTEGRATION — cashRegisterService.createMovement
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const { ValidationError } = require("../../../services/productService");
const { seedRegisterOnly, getMovements } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const kasir = { id: 2, name: "Kasir Test" };

async function openWithBalance(balance = 200000) {
  await seedRegisterOnly();
  return cashRegisterService.openShift({ opening_balance: balance }, kasir);
}

describe("cashRegisterService.createMovement", () => {
  test("menolak jika belum buka sesi", async () => {
    await seedRegisterOnly();
    await expect(
      cashRegisterService.createMovement(
        { type: "in", category: "setoran_modal", amount: 10000 },
        kasir,
      ),
    ).rejects.toThrow(/Tidak ada sesi kas/i);
  });

  test("menolak type tidak valid", async () => {
    await openWithBalance();
    await expect(
      cashRegisterService.createMovement(
        { type: "xfer", category: "lainnya", amount: 1000 },
        kasir,
      ),
    ).rejects.toThrow("Jenis pergerakan kas tidak valid");
  });

  test("menolak kategori kosong", async () => {
    await openWithBalance();
    await expect(
      cashRegisterService.createMovement(
        { type: "in", category: "", amount: 1000 },
        kasir,
      ),
    ).rejects.toThrow("Kategori wajib dipilih");
  });

  test("menolak amount <= 0", async () => {
    await openWithBalance();
    await expect(
      cashRegisterService.createMovement(
        { type: "in", category: "lainnya", amount: 0 },
        kasir,
      ),
    ).rejects.toThrow("Jumlah harus lebih dari 0");
  });

  test("kas masuk: expected_balance naik", async () => {
    const opened = await openWithBalance(100000);
    const updated = await cashRegisterService.createMovement(
      {
        type: "in",
        category: "setoran_modal",
        amount: 25000,
        description: "Setor tambahan",
      },
      kasir,
    );

    expect(Number(updated.expected_balance)).toBe(125000);
    expect(Number(updated.total_cash_in)).toBe(25000);

    const movements = await getMovements(opened.id);
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe("in");
    expect(Number(movements[0].amount)).toBe(25000);
  });

  test("kas keluar: expected_balance turun", async () => {
    await openWithBalance(100000);
    const updated = await cashRegisterService.createMovement(
      {
        type: "out",
        category: "sedekah_donasi",
        amount: 15000,
        description: "Donasi",
      },
      kasir,
    );

    expect(Number(updated.expected_balance)).toBe(85000);
    expect(Number(updated.total_cash_out)).toBe(15000);
  });

  test("kas keluar ditolak jika saldo laci tidak cukup", async () => {
    await openWithBalance(5000);
    await expect(
      cashRegisterService.createMovement(
        { type: "out", category: "lainnya", amount: 50000 },
        kasir,
      ),
    ).rejects.toThrow();
  });
});
