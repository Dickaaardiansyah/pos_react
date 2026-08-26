// tests/services/payableService/recordPayment.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const payableService = require("../../../services/payableService");
const {
  ValidationError,
  NotFoundError,
} = require("../../../services/productService");
const {
  seedSystemAccounts,
  seedRegisterAndShift,
  seedKasKantorBalance,
  seedBankBalance,
  getPayable,
  getPayments,
  futureDueDate,
} = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

async function createPayable(amount = 100000) {
  await seedSystemAccounts();
  return payableService.create({
    supplier_name: "Supplier Bayar",
    amount,
    due_date: futureDueDate(),
    recorded_by: "Admin",
  });
}

describe("payableService.recordPayment", () => {
  test("melempar NotFoundError jika hutang tidak ditemukan", async () => {
    await expect(
      payableService.recordPayment(
        999999,
        { amount: 1000, payment_source: "kantor" },
        admin,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  test("menolak amount <= 0", async () => {
    const p = await createPayable();
    await expect(
      payableService.recordPayment(
        p.id,
        { amount: 0, payment_source: "kantor" },
        admin,
      ),
    ).rejects.toThrow("Jumlah pembayaran harus lebih dari 0");
  });

  test("laci ditolak jika tidak ada sesi kas terbuka", async () => {
    const p = await createPayable(10000);
    await expect(
      payableService.recordPayment(
        p.id,
        { amount: 5000, payment_source: "laci" },
        admin,
      ),
    ).rejects.toThrow(/Tidak ada sesi kas/i);
  });

  test("laci sukses: paid_amount naik, shift_id terisi, status sebagian/lunas", async () => {
    const p = await createPayable(100000);
    const { shiftId } = await seedRegisterAndShift(2, 500000);

    const updated = await payableService.recordPayment(
      p.id,
      { amount: 40000, payment_source: "laci" },
      admin,
    );

    expect(Number(updated.paid_amount)).toBe(40000);
    expect(updated.status).toBe("sebagian");

    const payments = await getPayments(p.id);
    expect(payments).toHaveLength(1);
    expect(Number(payments[0].amount)).toBe(40000);
    expect(Number(payments[0].shift_id)).toBe(shiftId);
    expect(payments[0].payment_method).toBe("cash");
    expect(payments[0].recorded_by).toBe("Admin Test");
  });

  test("laci ditolak jika saldo tidak cukup", async () => {
    const p = await createPayable(100000);
    await seedRegisterAndShift(2, 1000); // kecil

    await expect(
      payableService.recordPayment(
        p.id,
        { amount: 50000, payment_source: "laci" },
        admin,
      ),
    ).rejects.toThrow(/tidak cukup/i);

    expect(Number((await getPayable(p.id)).paid_amount)).toBe(0);
  });

  test("laci dengan shift_id eksplisit", async () => {
    const p = await createPayable(20000);
    const { shiftId } = await seedRegisterAndShift(2, 100000);

    const updated = await payableService.recordPayment(
      p.id,
      { amount: 20000, payment_source: "laci", shift_id: shiftId },
      admin,
    );
    expect(updated.status).toBe("lunas");
    expect(Number(updated.paid_amount)).toBe(20000);
  });

  test("kantor (kas): shift_id null, payment cash", async () => {
    const p = await createPayable(30000);
    await seedKasKantorBalance(500000);

    const updated = await payableService.recordPayment(
      p.id,
      { amount: 30000, payment_source: "kantor", target_account: "kas" },
      admin,
    );
    expect(updated.status).toBe("lunas");
    const payments = await getPayments(p.id);
    expect(payments[0].shift_id).toBeNull();
    expect(payments[0].payment_method).toBe("cash");
  });

  test("kantor (bank): payment_method transfer", async () => {
    const p = await createPayable(15000);
    await seedBankBalance(500000);

    await payableService.recordPayment(
      p.id,
      { amount: 15000, payment_source: "kantor", target_account: "bank" },
      admin,
    );
    const payments = await getPayments(p.id);
    expect(payments[0].payment_method).toBe("transfer");
  });

  test("kantor ditolak jika saldo tidak cukup", async () => {
    const p = await createPayable(50000);
    await seedSystemAccounts(); // balance 0

    await expect(
      payableService.recordPayment(
        p.id,
        { amount: 50000, payment_source: "kantor", target_account: "kas" },
        admin,
      ),
    ).rejects.toThrow(/tidak cukup/i);
  });

  test("tanggal pembayaran default ke hari ini jika tidak dikirim", async () => {
    const p = await createPayable(10000);
    await seedKasKantorBalance(100000);
    const today = new Date().toISOString().slice(0, 10);

    await payableService.recordPayment(
      p.id,
      { amount: 10000, payment_source: "kantor" },
      admin,
    );
    const payments = await getPayments(p.id);
    const pd = payments[0].payment_date;
    const pdStr =
      pd instanceof Date ? pd.toISOString().slice(0, 10) : String(pd).slice(0, 10);
    expect(pdStr).toBe(today);
  });
});
