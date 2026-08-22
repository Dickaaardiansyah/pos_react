// tests/services/purchaseService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — purchaseService (pencatatan pembelian tunai/kredit ke supplier)
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("../../models/purchaseModel");
// FIX (sinkron dengan revisi dosen #14 — Sumber Dana Kas Laci/Kas Kantor):
// purchaseService.recordPurchase() sekarang meresolusi laci lewat
// cashRegisterService.getOpenShiftById()/listOpenShifts() (bukan lagi
// cashRegisterModel.findActiveShift() langsung), dan memvalidasi saldo
// Kas/Bank Kantor lewat journalService.getCurrentBalance() untuk sumber
// dana 'kantor'. Kedua service ini yang di-mock di sini, bukan lagi
// cashRegisterModel.
jest.mock("../../services/cashRegisterService");
jest.mock("../../services/journalService");

const purchaseModel = require("../../models/purchaseModel");
const cashRegisterService = require("../../services/cashRegisterService");
const journalService = require("../../services/journalService");
const purchaseService = require("../../services/purchaseService");
const { ValidationError } = require("../../services/productService");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("purchaseService.recordPurchase", () => {
  const user = { id: 3, name: "Admin Gudang" };
  const validItems = [{ product_id: 1, quantity: 10, unit_cost: 5000 }];

  test("menolak pembelian tanpa item", async () => {
    await expect(
      purchaseService.recordPurchase({ items: [] }, user),
    ).rejects.toThrow("Tidak ada produk dalam pembelian");
  });

  test("menolak item tanpa product_id", async () => {
    await expect(
      purchaseService.recordPurchase(
        { items: [{ quantity: 1, unit_cost: 1000 }] },
        user,
      ),
    ).rejects.toThrow("product_id wajib diisi");
  });

  test("menolak quantity item nol atau negatif", async () => {
    await expect(
      purchaseService.recordPurchase(
        { items: [{ product_id: 1, quantity: 0, unit_cost: 1000 }] },
        user,
      ),
    ).rejects.toThrow("harus lebih dari 0");
  });

  test("menolak unit_cost negatif", async () => {
    await expect(
      purchaseService.recordPurchase(
        { items: [{ product_id: 1, quantity: 1, unit_cost: -100 }] },
        user,
      ),
    ).rejects.toThrow("tidak valid");
  });

  test("menolak pembelian kredit tanpa nama supplier", async () => {
    await expect(
      purchaseService.recordPurchase(
        { items: validItems, payment_method: "kredit", supplier_name: "" },
        user,
      ),
    ).rejects.toThrow("Supplier wajib diisi untuk pembelian kredit");
  });

  // FIX (revisi dosen #14 — Sumber Dana): payment_source default ke 'laci'
  // untuk pembelian tunai. Kasus paling umum (satu laci kasir terbuka)
  // dipakai otomatis lewat listOpenShifts(), tanpa admin perlu pilih apa-apa.
  test("pembelian tunai, sumber dana 'laci' (default): dipakai otomatis kalau cuma ada SATU laci kasir terbuka, ditautkan ke shift & pemilik aslinya", async () => {
    cashRegisterService.listOpenShifts.mockResolvedValueOnce([
      {
        id: 42,
        opened_by_user_id: 7,
        expected_balance: 500000,
        opened_by: "Kasir A",
      },
    ]);
    purchaseModel.createPurchase.mockResolvedValueOnce({
      id: 1,
      purchase_code: "PBL1",
    });

    await purchaseService.recordPurchase(
      { items: validItems, payment_method: "tunai" },
      user,
    );

    expect(cashRegisterService.listOpenShifts).toHaveBeenCalled();
    const callArg = purchaseModel.createPurchase.mock.calls[0][0];
    expect(callArg.paymentMethod).toBe("tunai");
    expect(callArg.shiftId).toBe(42);
    // shiftUserId harus dari PEMILIK ASLI shift (7), BUKAN admin yang login
    // (3) — supaya lockOpenShift() di model memvalidasi kepemilikan kasir
    // yang sebenarnya memegang laci itu.
    expect(callArg.shiftUserId).toBe(7);
    expect(callArg.dueDate).toBeNull();
    expect(callArg.payableInvoiceCode).toBeNull();
  });

  test("pembelian tunai, sumber dana 'laci' dengan shift_id eksplisit: dipakai lewat cashRegisterService.getOpenShiftById, bukan listOpenShifts", async () => {
    cashRegisterService.getOpenShiftById.mockResolvedValueOnce({
      id: 55,
      opened_by_user_id: 8,
      expected_balance: 500000,
    });
    purchaseModel.createPurchase.mockResolvedValueOnce({ id: 2 });

    await purchaseService.recordPurchase(
      { items: validItems, payment_method: "tunai", shift_id: 55 },
      user,
    );

    expect(cashRegisterService.getOpenShiftById).toHaveBeenCalledWith(55);
    expect(cashRegisterService.listOpenShifts).not.toHaveBeenCalled();
    const callArg = purchaseModel.createPurchase.mock.calls[0][0];
    expect(callArg.shiftId).toBe(55);
    expect(callArg.shiftUserId).toBe(8);
  });

  test("pembelian tunai, sumber dana 'laci' ditolak jika saldo laci lebih kecil dari total pembelian", async () => {
    cashRegisterService.listOpenShifts.mockResolvedValueOnce([
      {
        id: 42,
        opened_by_user_id: 7,
        expected_balance: 10000,
        opened_by: "Kasir A",
      },
    ]);

    await expect(
      purchaseService.recordPurchase(
        { items: validItems, payment_method: "tunai" }, // total = 10 x 5000 = 50000
        user,
      ),
    ).rejects.toThrow(/tidak cukup/);
    expect(purchaseModel.createPurchase).not.toHaveBeenCalled();
  });

  test("pembelian tunai, sumber dana 'laci' ditolak jika tidak ada laci yang terbuka sama sekali", async () => {
    cashRegisterService.listOpenShifts.mockResolvedValueOnce([]);

    await expect(
      purchaseService.recordPurchase(
        { items: validItems, payment_method: "tunai" },
        user,
      ),
    ).rejects.toThrow(/Tidak ada sesi kas/);
    expect(purchaseModel.createPurchase).not.toHaveBeenCalled();
  });

  test("pembelian tunai, sumber dana 'kantor' (akun Kas): TIDAK menyentuh sesi kas sama sekali, shiftId null", async () => {
    journalService.getCurrentBalance.mockResolvedValueOnce(1000000);
    purchaseModel.createPurchase.mockResolvedValueOnce({ id: 4 });

    await purchaseService.recordPurchase(
      { items: validItems, payment_method: "tunai", payment_source: "kantor" },
      user,
    );

    expect(cashRegisterService.listOpenShifts).not.toHaveBeenCalled();
    expect(cashRegisterService.getOpenShiftById).not.toHaveBeenCalled();
    const callArg = purchaseModel.createPurchase.mock.calls[0][0];
    expect(callArg.shiftId).toBeNull();
    expect(callArg.shiftUserId).toBeNull();
  });

  test("pembelian tunai, sumber dana 'kantor' ditolak jika saldo Kas/Bank Kantor tidak cukup", async () => {
    journalService.getCurrentBalance.mockResolvedValueOnce(10000);

    await expect(
      purchaseService.recordPurchase(
        {
          items: validItems,
          payment_method: "tunai",
          payment_source: "kantor",
        },
        user,
      ),
    ).rejects.toThrow(/tidak cukup/);
    expect(purchaseModel.createPurchase).not.toHaveBeenCalled();
  });

  test("pembelian kredit: TIDAK mengecek/menautkan sesi kas sama sekali, dan membuat kode faktur hutang", async () => {
    purchaseModel.createPurchase.mockResolvedValueOnce({ id: 3 });

    await purchaseService.recordPurchase(
      {
        items: validItems,
        payment_method: "kredit",
        supplier_name: "CV Sumber Makmur",
      },
      user,
    );

    expect(cashRegisterService.listOpenShifts).not.toHaveBeenCalled();
    expect(cashRegisterService.getOpenShiftById).not.toHaveBeenCalled();
    expect(journalService.getCurrentBalance).not.toHaveBeenCalled();
    const callArg = purchaseModel.createPurchase.mock.calls[0][0];
    expect(callArg.paymentMethod).toBe("kredit");
    expect(callArg.shiftId).toBeNull();
    expect(callArg.payableInvoiceCode).toEqual(expect.stringContaining("HUT-"));
    expect(callArg.dueDate).not.toBeNull();
  });

  test("payment_method selain 'kredit' selalu dianggap 'tunai' (default aman)", async () => {
    journalService.getCurrentBalance.mockResolvedValueOnce(1000000);
    purchaseModel.createPurchase.mockResolvedValueOnce({ id: 5 });

    await purchaseService.recordPurchase(
      {
        items: validItems,
        payment_method: "metode_aneh",
        payment_source: "kantor",
      },
      user,
    );
    const callArg = purchaseModel.createPurchase.mock.calls[0][0];
    expect(callArg.paymentMethod).toBe("tunai");
  });
});
