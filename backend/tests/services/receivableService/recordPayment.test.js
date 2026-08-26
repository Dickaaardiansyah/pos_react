// tests/services/receivableService/recordPayment.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const receivableService = require("../../../services/receivableService");
const {
  ValidationError,
  NotFoundError,
} = require("../../../services/productService");
const {
  seedSystemAccounts,
  seedRegisterAndShift,
  insertReceivable,
  getReceivable,
  getPayments,
} = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test", role: "admin" };
const kasir = { id: 2, name: "Kasir Test", role: "cashier" };

describe("receivableService.recordPayment", () => {
  test("melempar NotFoundError jika piutang tidak ada", async () => {
    await expect(
      receivableService.recordPayment(999999, { amount: 1000 }, admin),
    ).rejects.toThrow(NotFoundError);
  });

  test("menolak amount <= 0", async () => {
    await seedSystemAccounts();
    const id = await insertReceivable({ amount: 50000 });
    await expect(
      receivableService.recordPayment(id, { amount: 0 }, admin),
    ).rejects.toThrow(/lebih dari 0/i);
  });

  test("menolak pembayaran melebihi sisa piutang", async () => {
    await seedSystemAccounts();
    const id = await insertReceivable({ amount: 10000, paidAmount: 0 });
    await expect(
      receivableService.recordPayment(id, { amount: 15000 }, admin),
    ).rejects.toThrow(/melebihi sisa/i);
  });

  test("admin bayar cash tanpa shift: paid_amount naik, status sebagian", async () => {
    await seedSystemAccounts();
    const id = await insertReceivable({ amount: 100000 });
    const updated = await receivableService.recordPayment(
      id,
      { amount: 40000, payment_method: "cash" },
      admin,
    );
    expect(Number(updated.paid_amount)).toBe(40000);
    expect(updated.status).toBe("sebagian");

    const payments = await getPayments(id);
    expect(payments).toHaveLength(1);
    expect(Number(payments[0].amount)).toBe(40000);
    expect(payments[0].recorded_by).toBe("Admin Test");
    expect(payments[0].shift_id).toBeNull();
  });

  test("pelunasan penuh → status lunas", async () => {
    await seedSystemAccounts();
    const id = await insertReceivable({ amount: 25000 });
    const updated = await receivableService.recordPayment(
      id,
      { amount: 25000, payment_method: "transfer" },
      admin,
    );
    expect(updated.status).toBe("lunas");
    expect(Number(updated.paid_amount)).toBe(25000);
  });

  test("kasir bayar cash tanpa buka sesi → ditolak", async () => {
    await seedSystemAccounts();
    const id = await insertReceivable({ amount: 10000 });
    await expect(
      receivableService.recordPayment(
        id,
        { amount: 5000, payment_method: "cash" },
        kasir,
      ),
    ).rejects.toThrow(/Buka kas terlebih dahulu/i);
  });

  test("kasir bayar cash dengan sesi open: shift_id terisi", async () => {
    await seedSystemAccounts();
    const id = await insertReceivable({ amount: 30000 });
    const { shiftId } = await seedRegisterAndShift(kasir.id, 50000);

    const updated = await receivableService.recordPayment(
      id,
      { amount: 10000, payment_method: "cash" },
      kasir,
    );
    expect(Number(updated.paid_amount)).toBe(10000);

    const payments = await getPayments(id);
    expect(Number(payments[0].shift_id)).toBe(shiftId);
  });

  test("kasir bayar non-cash (transfer) tanpa shift diperbolehkan", async () => {
    await seedSystemAccounts();
    const id = await insertReceivable({ amount: 20000 });
    const updated = await receivableService.recordPayment(
      id,
      { amount: 20000, payment_method: "transfer" },
      kasir,
    );
    expect(updated.status).toBe("lunas");
    const payments = await getPayments(id);
    expect(payments[0].shift_id).toBeNull();
    expect(payments[0].payment_method).toBe("transfer");
  });

  test("tanggal pembayaran default hari ini", async () => {
    await seedSystemAccounts();
    const id = await insertReceivable({ amount: 5000 });
    const today = new Date().toISOString().slice(0, 10);
    await receivableService.recordPayment(id, { amount: 5000 }, admin);
    const payments = await getPayments(id);
    const pd = payments[0].payment_date;
    const pdStr =
      pd instanceof Date ? pd.toISOString().slice(0, 10) : String(pd).slice(0, 10);
    expect(pdStr).toBe(today);
  });
});
