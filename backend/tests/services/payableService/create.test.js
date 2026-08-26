// tests/services/payableService/create.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const payableService = require("../../../services/payableService");
const { ValidationError } = require("../../../services/productService");
const {
  seedSystemAccounts,
  getPayable,
  futureDueDate,
} = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("payableService.create", () => {
  test("menolak jika nama pemasok kosong", async () => {
    await expect(
      payableService.create({
        supplier_name: "  ",
        amount: 10000,
        due_date: futureDueDate(),
      }),
    ).rejects.toThrow("Nama pemasok wajib diisi");
  });

  test("menolak jumlah hutang <= 0", async () => {
    await expect(
      payableService.create({
        supplier_name: "Supplier",
        amount: 0,
        due_date: futureDueDate(),
      }),
    ).rejects.toThrow("Jumlah hutang harus lebih dari 0");
  });

  test("menolak jika tanggal jatuh tempo tidak diisi", async () => {
    await expect(
      payableService.create({
        supplier_name: "Supplier",
        amount: 50000,
      }),
    ).rejects.toThrow("Tanggal jatuh tempo wajib diisi");
  });

  test("paid_amount dari client diabaikan — selalu 0 & status belum_lunas", async () => {
    await seedSystemAccounts();
    const result = await payableService.create({
      supplier_name: "CV Maju",
      amount: 100000,
      paid_amount: 50000, // harus diabaikan
      due_date: futureDueDate(),
      recorded_by: "Admin Test",
    });

    expect(result.invoice_code).toMatch(/^HUT-/);
    expect(Number(result.amount)).toBe(100000);
    expect(Number(result.paid_amount)).toBe(0);
    expect(result.status).toBe("belum_lunas");
    expect(result.supplier_name).toBe("CV Maju");

    const row = await getPayable(result.id);
    expect(Number(row.paid_amount)).toBe(0);
    expect(row.status).toBe("belum_lunas");
  });
});
