// tests/services/payableService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — payableService: pencatatan hutang supplier & pelunasan
// (settlement flow), termasuk aturan penautan pembayaran cash ke sesi kas
// aktif dan larangan hapus hutang yang sudah ada pembayaran.
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("../../models/payableModel");
jest.mock("../../models/purchaseModel");
// FIX (sinkron dengan revisi dosen #14 — Sumber Dana Kas Laci/Kas Kantor):
// payableService.recordPayment() sekarang meresolusi laci lewat
// cashRegisterService.getOpenShiftById()/listOpenShifts() (bukan lagi
// cashRegisterModel.findActiveShift() langsung), dan memvalidasi saldo
// Kas/Bank Kantor lewat journalService.getCurrentBalance() untuk sumber
// dana 'kantor'. Kedua service ini yang di-mock di sini, bukan lagi
// cashRegisterModel.
jest.mock("../../services/cashRegisterService");
jest.mock("../../services/journalService");

const payableModel = require("../../models/payableModel");
const cashRegisterService = require("../../services/cashRegisterService");
const journalService = require("../../services/journalService");
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

  // FIX (revisi dosen #14 — Sumber Dana): payment_source default ke 'laci'
  // kalau tidak dikirim. Kasus paling umum (satu laci kasir terbuka) dipakai
  // otomatis lewat listOpenShifts(), tanpa admin perlu pilih shift_id.
  test("sumber dana 'laci' (default): dipakai otomatis kalau cuma ada SATU laci kasir terbuka, ditautkan ke shift & pemilik aslinya", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    cashRegisterService.listOpenShifts.mockResolvedValueOnce([
      {
        id: 77,
        opened_by_user_id: 42,
        expected_balance: 500000,
        opened_by: "Kasir A",
      },
    ]);
    payableModel.addPayment.mockResolvedValueOnce({});
    payableModel.findById.mockResolvedValueOnce({ id: 1, status: "sebagian" });

    await payableService.recordPayment(1, { amount: 50000 }, { id: 9 });

    expect(cashRegisterService.listOpenShifts).toHaveBeenCalled();
    const callArg = payableModel.addPayment.mock.calls[0][1];
    expect(callArg.shiftId).toBe(77);
    // shiftUserId harus dari PEMILIK ASLI shift (42), BUKAN user yang login (9)
    // — supaya lockOpenShift() memvalidasi kepemilikan kasir yang sebenarnya.
    expect(callArg.shiftUserId).toBe(42);
    expect(callArg.paymentMethod).toBe("cash");
  });

  test("sumber dana 'laci' dengan shift_id eksplisit: dipakai lewat cashRegisterService.getOpenShiftById, bukan listOpenShifts", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    cashRegisterService.getOpenShiftById.mockResolvedValueOnce({
      id: 88,
      opened_by_user_id: 5,
      expected_balance: 200000,
    });
    payableModel.addPayment.mockResolvedValueOnce({});
    payableModel.findById.mockResolvedValueOnce({ id: 1 });

    await payableService.recordPayment(
      1,
      { amount: 50000, payment_source: "laci", shift_id: 88 },
      { id: 9 },
    );

    expect(cashRegisterService.getOpenShiftById).toHaveBeenCalledWith(88);
    expect(cashRegisterService.listOpenShifts).not.toHaveBeenCalled();
    const callArg = payableModel.addPayment.mock.calls[0][1];
    expect(callArg.shiftId).toBe(88);
    expect(callArg.shiftUserId).toBe(5);
  });

  test("sumber dana 'laci' ditolak jika saldo laci lebih kecil dari jumlah pembayaran", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    cashRegisterService.listOpenShifts.mockResolvedValueOnce([
      {
        id: 77,
        opened_by_user_id: 42,
        expected_balance: 10000,
        opened_by: "Kasir A",
      },
    ]);

    await expect(
      payableService.recordPayment(1, { amount: 50000 }, { id: 9 }),
    ).rejects.toThrow(/tidak cukup/);
    expect(payableModel.addPayment).not.toHaveBeenCalled();
  });

  test("sumber dana 'laci' ditolak jika lebih dari satu laci sedang terbuka tanpa shift_id eksplisit", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    cashRegisterService.listOpenShifts.mockResolvedValueOnce([
      { id: 77, opened_by_user_id: 42, expected_balance: 500000 },
      { id: 78, opened_by_user_id: 43, expected_balance: 500000 },
    ]);

    await expect(
      payableService.recordPayment(1, { amount: 50000 }, { id: 9 }),
    ).rejects.toThrow(/lebih dari satu laci/);
  });

  test("sumber dana 'kantor' (akun Kas): TIDAK menyentuh sesi kas sama sekali, shiftId null, paymentMethod 'cash'", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    journalService.getCurrentBalance.mockResolvedValueOnce(1000000);
    payableModel.addPayment.mockResolvedValueOnce({});
    payableModel.findById.mockResolvedValueOnce({ id: 1 });

    await payableService.recordPayment(
      1,
      { amount: 50000, payment_source: "kantor" },
      { id: 9 },
    );

    expect(cashRegisterService.listOpenShifts).not.toHaveBeenCalled();
    expect(cashRegisterService.getOpenShiftById).not.toHaveBeenCalled();
    const callArg = payableModel.addPayment.mock.calls[0][1];
    expect(callArg.shiftId).toBeNull();
    expect(callArg.shiftUserId).toBeNull();
    expect(callArg.paymentMethod).toBe("cash");
  });

  test("sumber dana 'kantor' dengan target_account 'bank': paymentMethod jadi 'transfer', dicek terhadap saldo Bank", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    journalService.getCurrentBalance.mockResolvedValueOnce(1000000);
    payableModel.addPayment.mockResolvedValueOnce({});
    payableModel.findById.mockResolvedValueOnce({ id: 1 });

    await payableService.recordPayment(
      1,
      { amount: 50000, payment_source: "kantor", target_account: "bank" },
      { id: 9 },
    );

    expect(journalService.getCurrentBalance).toHaveBeenCalledWith(
      journalService.ACC.BANK,
      expect.any(String),
    );
    const callArg = payableModel.addPayment.mock.calls[0][1];
    expect(callArg.paymentMethod).toBe("transfer");
    expect(callArg.shiftId).toBeNull();
  });

  test("sumber dana 'kantor' ditolak jika saldo Kas/Bank tidak cukup", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    journalService.getCurrentBalance.mockResolvedValueOnce(10000);

    await expect(
      payableService.recordPayment(
        1,
        { amount: 50000, payment_source: "kantor" },
        { id: 9 },
      ),
    ).rejects.toThrow(/tidak cukup/);
    expect(payableModel.addPayment).not.toHaveBeenCalled();
  });

  test("tanggal pembayaran default ke hari ini jika tidak dikirim", async () => {
    payableModel.findById.mockResolvedValueOnce({ id: 1 });
    journalService.getCurrentBalance.mockResolvedValueOnce(1000000);
    payableModel.addPayment.mockResolvedValueOnce({});
    payableModel.findById.mockResolvedValueOnce({ id: 1 });

    await payableService.recordPayment(
      1,
      { amount: 20000, payment_source: "kantor" },
      { id: 9 },
    );
    const callArg = payableModel.addPayment.mock.calls[0][1];
    const today = new Date().toISOString().slice(0, 10);
    expect(callArg.paymentDate).toBe(today);
  });
});
