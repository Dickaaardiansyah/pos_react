// tests/services/transactionService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — transactionService (checkout kasir & pembatalan transaksi)
//
// Semua model (transactionModel, cashRegisterModel, settingModel) di-mock,
// sehingga test ini murni memverifikasi ATURAN BISNIS: validasi item kosong,
// syarat Open Bill, wajib sesi kas aktif, kepemilikan transaksi dari token
// login (bukan dari body request), dan aturan pembatalan transaksi.
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("../../models/transactionModel");
jest.mock("../../models/cashRegisterModel");
jest.mock("../../models/settingModel");

const transactionModel = require("../../models/transactionModel");
const cashRegisterModel = require("../../models/cashRegisterModel");
const settingModel = require("../../models/settingModel");
const { transactionService } = require("../../services/transactionService");
const { ValidationError, NotFoundError } = require("../../services/productService");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("transactionService.checkout", () => {
  const user = { id: 7, name: "Kasir Budi" };

  test("menolak checkout tanpa item", async () => {
    await expect(
      transactionService.checkout({ items: [], payment_method: "cash" }, user),
    ).rejects.toThrow(ValidationError);
  });

  test("menolak checkout Open Bill tanpa nama pelanggan", async () => {
    await expect(
      transactionService.checkout(
        {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: "open_bill",
          customer_name: "  ",
        },
        user,
      ),
    ).rejects.toThrow("Pelanggan wajib dipilih");
  });

  test("menolak checkout jika kasir belum membuka sesi kas", async () => {
    cashRegisterModel.findActiveShift.mockResolvedValueOnce(null);
    await expect(
      transactionService.checkout(
        { items: [{ product_id: 1, quantity: 1 }], payment_method: "cash" },
        user,
      ),
    ).rejects.toThrow("Tidak ada sesi kas yang sedang Anda buka");
  });

  test("kepemilikan transaksi (cashier_id, shift_id) SELALU diambil dari user token, bukan dari payload", async () => {
    cashRegisterModel.findActiveShift.mockResolvedValueOnce({ id: 55 });
    transactionModel.createSale.mockResolvedValueOnce({ id: 1, transaction_code: "TSR1" });

    await transactionService.checkout(
      {
        items: [{ product_id: 1, quantity: 1 }],
        payment_method: "cash",
        payment_amount: 20000,
        // Percobaan memalsukan identitas kasir lewat body — harus diabaikan.
        cashier_id: 999,
        cashier_name: "Bukan Kasir Budi",
      },
      user,
    );

    expect(cashRegisterModel.findActiveShift).toHaveBeenCalledWith(user.id);
    const callArg = transactionModel.createSale.mock.calls[0][0];
    expect(callArg.cashierId).toBe(user.id);
    expect(callArg.cashierName).toBe(user.name);
    expect(callArg.shiftId).toBe(55);
  });

  test("checkout Open Bill dengan nama pelanggan valid: dibuatkan invoiceCode & dueDate default", async () => {
    cashRegisterModel.findActiveShift.mockResolvedValueOnce({ id: 1 });
    transactionModel.createSale.mockResolvedValueOnce({ id: 2 });

    await transactionService.checkout(
      {
        items: [{ product_id: 1, quantity: 2 }],
        payment_method: "open_bill",
        customer_name: "Toko Sumber Rahayu",
      },
      user,
    );

    const callArg = transactionModel.createSale.mock.calls[0][0];
    expect(callArg.openBill).toEqual(
      expect.objectContaining({
        invoiceCode: expect.stringContaining("PIU-"),
        dueDate: expect.any(String),
      }),
    );
  });

  test("checkout non-Open Bill: field openBill dikirim null", async () => {
    cashRegisterModel.findActiveShift.mockResolvedValueOnce({ id: 1 });
    transactionModel.createSale.mockResolvedValueOnce({ id: 3 });

    await transactionService.checkout(
      { items: [{ product_id: 1, quantity: 1 }], payment_method: "cash" },
      user,
    );
    const callArg = transactionModel.createSale.mock.calls[0][0];
    expect(callArg.openBill).toBeNull();
  });

  test("error dari model yang mengandung kata 'kurang' ditandai sebagai kesalahan pengguna (status 400)", async () => {
    cashRegisterModel.findActiveShift.mockResolvedValueOnce({ id: 1 });
    transactionModel.createSale.mockRejectedValueOnce(new Error("Stok produk kurang"));

    await expect(
      transactionService.checkout(
        { items: [{ product_id: 1, quantity: 100 }], payment_method: "cash" },
        user,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  test("error dari model yang tidak dikenali ditandai sebagai error server (status 500)", async () => {
    cashRegisterModel.findActiveShift.mockResolvedValueOnce({ id: 1 });
    transactionModel.createSale.mockRejectedValueOnce(new Error("Koneksi database terputus"));

    await expect(
      transactionService.checkout(
        { items: [{ product_id: 1, quantity: 1 }], payment_method: "cash" },
        user,
      ),
    ).rejects.toMatchObject({ status: 500 });
  });
});

describe("transactionService.voidTransaction", () => {
  test("menolak jika alasan pembatalan kosong", async () => {
    await expect(
      transactionService.voidTransaction(1, { reason: "  ", voided_by: "Admin" }),
    ).rejects.toThrow("Alasan pembatalan wajib diisi");
  });

  test("menolak jika akun admin yang membatalkan sudah nonaktif", async () => {
    settingModel.findPublicUserById.mockResolvedValueOnce({ id: 9, is_active: false });
    await expect(
      transactionService.voidTransaction(1, {
        reason: "Salah input",
        voided_by: "Admin",
        adminUserId: 9,
      }),
    ).rejects.toThrow("Akun Anda tidak aktif");
  });

  test("melempar NotFoundError jika transaksi tidak ditemukan", async () => {
    transactionModel.findById.mockResolvedValueOnce(null);
    await expect(
      transactionService.voidTransaction(1, { reason: "Salah input", voided_by: "Admin" }),
    ).rejects.toThrow(NotFoundError);
  });

  test("menolak membatalkan transaksi yang sudah berstatus cancelled sebelumnya", async () => {
    transactionModel.findById.mockResolvedValueOnce({ id: 1, status: "cancelled" });
    await expect(
      transactionService.voidTransaction(1, { reason: "Salah input", voided_by: "Admin" }),
    ).rejects.toThrow("sudah dibatalkan sebelumnya");
  });

  test("berhasil membatalkan transaksi berstatus completed", async () => {
    transactionModel.findById.mockResolvedValueOnce({ id: 1, status: "completed" });
    transactionModel.voidTransaction.mockResolvedValueOnce({ id: 1, status: "cancelled" });

    const result = await transactionService.voidTransaction(1, {
      reason: "  Salah input harga  ",
      voided_by: "Admin",
    });
    expect(transactionModel.voidTransaction).toHaveBeenCalledWith(1, {
      reason: "Salah input harga", // trimmed
      voidedBy: "Admin",
    });
    expect(result.status).toBe("cancelled");
  });
});
