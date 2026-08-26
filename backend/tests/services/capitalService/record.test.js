// tests/services/capitalService/record.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const capitalService = require("../../../services/capitalService");
const { ValidationError } = require("../../../services/productService");
const {
  seedSystemAccounts,
  seedRegisterAndShift,
  seedKasBalance,
  getCapital,
  today,
} = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("capitalService.record — validasi", () => {
  test("menolak tanpa tanggal", async () => {
    await expect(
      capitalService.record(
        { type: "setoran", amount: 1000 },
        admin,
      ),
    ).rejects.toThrow("Tanggal transaksi modal wajib diisi");
  });

  test("menolak type tidak valid", async () => {
    await expect(
      capitalService.record(
        { transaction_date: today(), type: "xyz", amount: 1000 },
        admin,
      ),
    ).rejects.toThrow("Jenis transaksi modal tidak valid");
  });

  test("menolak amount <= 0", async () => {
    await expect(
      capitalService.record(
        { transaction_date: today(), type: "setoran", amount: 0 },
        admin,
      ),
    ).rejects.toThrow("Jumlah harus lebih dari 0");
  });

  test("menolak target_account tidak valid", async () => {
    await expect(
      capitalService.record(
        {
          transaction_date: today(),
          type: "setoran",
          amount: 1000,
          target_account: "emoney",
        },
        admin,
      ),
    ).rejects.toThrow("Akun tujuan tidak valid");
  });

  test("Modal Awal harus setoran", async () => {
    await expect(
      capitalService.record(
        {
          transaction_date: today(),
          type: "penarikan",
          amount: 1000,
          is_initial: true,
          target_account: "kas",
          payment_source: "kantor",
        },
        admin,
      ),
    ).rejects.toThrow(/Modal Awal harus berupa setoran/i);
  });
});

describe("capitalService.record — setoran", () => {
  test("setoran Modal Awal ke Kas Kantor", async () => {
    await seedSystemAccounts();
    const tx = await capitalService.record(
      {
        transaction_date: today(),
        type: "setoran",
        amount: 5_000_000,
        is_initial: true,
        target_account: "kas",
        payment_source: "kantor",
      },
      admin,
    );

    expect(tx.transaction_code).toMatch(/^MDL/);
    expect(tx.type).toBe("setoran");
    expect(Number(tx.is_initial)).toBe(1);
    expect(Number(tx.amount)).toBe(5000000);
    expect(tx.shift_id).toBeNull();
    expect(tx.recorded_by).toBe("Admin Test");
  });

  test("Modal Awal hanya boleh sekali", async () => {
    await seedSystemAccounts();
    await capitalService.record(
      {
        transaction_date: today(),
        type: "setoran",
        amount: 1000000,
        is_initial: true,
        target_account: "kas",
        payment_source: "kantor",
      },
      admin,
    );
    await expect(
      capitalService.record(
        {
          transaction_date: today(),
          type: "setoran",
          amount: 500000,
          is_initial: true,
          target_account: "kas",
          payment_source: "kantor",
        },
        admin,
      ),
    ).rejects.toThrow(/Modal Awal sudah pernah diinput/i);
  });

  test("setoran tambahan ke Bank", async () => {
    await seedSystemAccounts();
    const tx = await capitalService.record(
      {
        transaction_date: today(),
        type: "setoran",
        amount: 200000,
        target_account: "bank",
      },
      admin,
    );
    expect(tx.target_account).toBe("bank");
    expect(tx.shift_id).toBeNull();
    expect(Number(tx.is_initial)).toBe(0);
  });

  test("setoran ke laci: shift_id terisi", async () => {
    await seedSystemAccounts();
    const { shiftId } = await seedRegisterAndShift(2, 100000);
    const tx = await capitalService.record(
      {
        transaction_date: today(),
        type: "setoran",
        amount: 50000,
        target_account: "kas",
        payment_source: "laci",
        shift_id: shiftId,
      },
      admin,
    );
    expect(Number(tx.shift_id)).toBe(shiftId);
  });

  test("setoran laci ditolak jika tidak ada shift open", async () => {
    await seedSystemAccounts();
    await expect(
      capitalService.record(
        {
          transaction_date: today(),
          type: "setoran",
          amount: 10000,
          target_account: "kas",
          payment_source: "laci",
        },
        admin,
      ),
    ).rejects.toThrow(/Tidak ada sesi kas/i);
  });
});

describe("capitalService.record — penarikan (prive)", () => {
  test("penarikan dari Kas Kantor: butuh saldo cukup", async () => {
    await seedKasBalance(500000);
    const tx = await capitalService.record(
      {
        transaction_date: today(),
        type: "penarikan",
        amount: 100000,
        target_account: "kas",
        payment_source: "kantor",
      },
      admin,
    );
    expect(tx.type).toBe("penarikan");
    expect(Number(tx.amount)).toBe(100000);
  });

  test("penarikan Kas Kantor ditolak jika saldo kurang", async () => {
    await seedSystemAccounts(); // balance 0
    await expect(
      capitalService.record(
        {
          transaction_date: today(),
          type: "penarikan",
          amount: 50000,
          target_account: "kas",
          payment_source: "kantor",
        },
        admin,
      ),
    ).rejects.toThrow(/tidak cukup/i);
  });

  test("penarikan dari laci: cek expected_balance", async () => {
    await seedSystemAccounts();
    await seedRegisterAndShift(2, 20000);
    await expect(
      capitalService.record(
        {
          transaction_date: today(),
          type: "penarikan",
          amount: 100000,
          target_account: "kas",
          payment_source: "laci",
        },
        admin,
      ),
    ).rejects.toThrow(/tidak cukup/i);
  });

  test("penarikan dari laci saldo cukup: sukses", async () => {
    await seedSystemAccounts();
    const { shiftId } = await seedRegisterAndShift(2, 300000);
    const tx = await capitalService.record(
      {
        transaction_date: today(),
        type: "penarikan",
        amount: 50000,
        target_account: "kas",
        payment_source: "laci",
        shift_id: shiftId,
      },
      admin,
    );
    expect(Number(tx.shift_id)).toBe(shiftId);
    const row = await getCapital(tx.id);
    expect(row.type).toBe("penarikan");
  });
});
