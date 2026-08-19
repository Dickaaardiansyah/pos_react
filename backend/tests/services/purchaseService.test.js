// tests/services/purchaseService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — purchaseService (pencatatan pembelian tunai/kredit ke supplier)
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("../../models/purchaseModel");
jest.mock("../../models/cashRegisterModel");

const purchaseModel = require("../../models/purchaseModel");
const cashRegisterModel = require("../../models/cashRegisterModel");
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

  test("pembelian tunai: ditautkan ke sesi kas aktif milik kasir yang mencatat", async () => {
    cashRegisterModel.findActiveShift.mockResolvedValueOnce({ id: 42 });
    purchaseModel.createPurchase.mockResolvedValueOnce({ id: 1, purchase_code: "PBL1" });

    await purchaseService.recordPurchase(
      { items: validItems, payment_method: "tunai" },
      user,
    );

    expect(cashRegisterModel.findActiveShift).toHaveBeenCalledWith(user.id);
    const callArg = purchaseModel.createPurchase.mock.calls[0][0];
    expect(callArg.paymentMethod).toBe("tunai");
    expect(callArg.shiftId).toBe(42);
    expect(callArg.dueDate).toBeNull();
    expect(callArg.payableInvoiceCode).toBeNull();
  });

  test("pembelian tunai tanpa sesi kas aktif: tetap boleh, shiftId null (tidak tertaut ke rekonsiliasi kas manapun)", async () => {
    cashRegisterModel.findActiveShift.mockResolvedValueOnce(null);
    purchaseModel.createPurchase.mockResolvedValueOnce({ id: 2 });

    await purchaseService.recordPurchase(
      { items: validItems, payment_method: "tunai" },
      user,
    );
    const callArg = purchaseModel.createPurchase.mock.calls[0][0];
    expect(callArg.shiftId).toBeNull();
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

    expect(cashRegisterModel.findActiveShift).not.toHaveBeenCalled();
    const callArg = purchaseModel.createPurchase.mock.calls[0][0];
    expect(callArg.paymentMethod).toBe("kredit");
    expect(callArg.shiftId).toBeNull();
    expect(callArg.payableInvoiceCode).toEqual(expect.stringContaining("HUT-"));
    expect(callArg.dueDate).not.toBeNull();
  });

  test("payment_method selain 'kredit' selalu dianggap 'tunai' (default aman)", async () => {
    cashRegisterModel.findActiveShift.mockResolvedValueOnce(null);
    purchaseModel.createPurchase.mockResolvedValueOnce({ id: 4 });

    await purchaseService.recordPurchase(
      { items: validItems, payment_method: "metode_aneh" },
      user,
    );
    const callArg = purchaseModel.createPurchase.mock.calls[0][0];
    expect(callArg.paymentMethod).toBe("tunai");
  });
});
