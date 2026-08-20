// tests/services/payableService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — payableService: pencatatan hutang supplier & pelunasan
// (settlement flow), termasuk aturan penautan pembayaran cash ke sesi kas
// aktif dan larangan hapus hutang yang sudah ada pembayaran.
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("../../models/payableModel");
jest.mock("../../models/purchaseModel");
jest.mock("../../models/cashRegisterModel");

const payableModel = require("../../models/payableModel");
const cashRegisterModel = require("../../models/cashRegisterModel");
const payableService = require("../../services/payableService");
const {
  ValidationError,
  NotFoundError,
} = require("../../services/productService");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("payableService.create", () => {
  test("menolak jika nama pemasok kosong", async () => {
    await expect(
      payableService.create({
        supplier_name: "  ",
        amount: 100000,
        due_date: "2026-09-01",
      }),
    ).rejects.toThrow("Nama pemasok wajib diisi");
  });

  test("menolak jumlah hutang <= 0", async () => {
    await expect(
      payableService.create({
        supplier_name: "CV Maju",
        amount: 0,
        due_date: "2026-09-01",
      }),
    ).rejects.toThrow("Jumlah hutang harus lebih dari 0");
  });

  test("menolak jika tanggal jatuh tempo tidak diisi", async () => {
    await expect(
      payableService.create({ supplier_name: "CV Maju", amount: 100000 }),
    ).rejects.toThrow("Tanggal jatuh tempo wajib diisi");
  });

  // FIX (revisi dosen #11): paid_amount tidak lagi diterima dari client saat
  // membuat hutang manual — payableModel.create() SELALU dipanggil dengan
  // paidAmount: 0, dan status SELALU "belum_lunas" saat baris baru dibuat.
  // Semua pembayaran (termasuk yang dulu dianggap "DP awal") wajib lewat
  // recordPayment(), supaya tiap pembayaran selalu punya jurnal
  // Dr Utang/Cr Kas sendiri dan subledger selalu sinkron dengan GL.
  test("paid_amount dari client diabaikan — payableModel.create selalu dipanggil dengan paidAmount 0 dan status belum_lunas", async () => {
    payableModel.create.mockResolvedValueOnce({ insertId: 1 });
    payableModel.findById.mockResolvedValueOnce({
      id: 1,
      status: "belum_lunas",
    });
    await payableService.create({
      supplier_name: "CV Maju",
      amount: 100000,
      due_date: "2026-09-01",
      paid_amount: 40000, // seharusnya diabaikan sepenuhnya
    });
    expect(payableModel.create.mock.calls[0][0].paidAmount).toBe(0);
    expect(payableModel.create.mock.calls[0][0].status).toBe("belum_lunas");
  });
});

describe("payableService.remove", () => {
  test("melempar NotFoundError jika hutang tidak ada", async () => {
    payableModel.findById.mockResolvedValueOnce(null);
    await expect(payableService.remove(1)).rejects.toThrow(NotFoundError);
  });

  test("menolak hapus hutang yang sudah ada pembayaran (paid_amount > 0)", async () => {
    payableModel.findById.mockResolvedValueOnce({
      id: 1,
      paid_amount: "50000",
      purchase_id: null,
    });
    await expect(payableService.remove(1)).rejects.toThrow(
      "sudah ada pembayaran tidak dapat dihapus",
    );
  });

  test("menolak hapus hutang yang tertaut ke pembelian kredit (purchase_id terisi)", async () => {
    payableModel.findById.mockResolvedValueOnce({
      id: 1,
      paid_amount: "0",
      purchase_id: 10,
    });
    await expect(payableService.remove(1)).rejects.toThrow(
      "tertaut ke pembelian kredit",
    );
  });

  test("berhasil hapus hutang manual yang belum pernah dibayar", async () => {
    payableModel.findById.mockResolvedValueOnce({
      id: 1,
      paid_amount: "0",
      purchase_id: null,
    });
    await payableService.remove(1);
    expect(payableModel.remove).toHaveBeenCalledWith(1);
  });
});

describe("payableService.recordPayment (pelunasan hutang)", () => {
  test("melempar NotFoundError jika hutang tidak ditemukan", async () => {
    payableModel.findById.mockResolvedValueOnce(null);
    await expect(
      payableService.recordPayment(1, { amount: 50000 }, { id: 1 }),
    ).rejects.toThrow(NotFoundError);
  });

  test("pembayaran metode cash: ditautkan ke sesi kas aktif milik kasir yang membayar", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    cashRegisterModel.findActiveShift.mockResolvedValueOnce({ id: 77 });
    payableModel.addPayment.mockResolvedValueOnce({});
    payableModel.findById.mockResolvedValueOnce({ id: 1, status: "sebagian" });

    await payableService.recordPayment(1, { amount: 50000 }, { id: 9 });

    expect(cashRegisterModel.findActiveShift).toHaveBeenCalledWith(9);
    const callArg = payableModel.addPayment.mock.calls[0][1];
    expect(callArg.shiftId).toBe(77);
    expect(callArg.paymentMethod).toBe("cash"); // default
  });

  test("pembayaran metode non-cash (mis. transfer): TIDAK mengecek sesi kas sama sekali", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    payableModel.addPayment.mockResolvedValueOnce({});
    payableModel.findById.mockResolvedValueOnce({ id: 1 });

    await payableService.recordPayment(
      1,
      { amount: 50000, payment_method: "transfer" },
      { id: 9 },
    );

    expect(cashRegisterModel.findActiveShift).not.toHaveBeenCalled();
    const callArg = payableModel.addPayment.mock.calls[0][1];
    expect(callArg.shiftId).toBeNull();
    expect(callArg.paymentMethod).toBe("transfer");
  });

  test("tanggal pembayaran default ke hari ini jika tidak dikirim", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    payableModel.addPayment.mockResolvedValueOnce({});
    payableModel.findById.mockResolvedValueOnce({ id: 1 });

    await payableService.recordPayment(
      1,
      { amount: 20000, payment_method: "transfer" },
      { id: 9 },
    );
    const callArg = payableModel.addPayment.mock.calls[0][1];
    const today = new Date().toISOString().slice(0, 10);
    expect(callArg.paymentDate).toBe(today);
  });
});
