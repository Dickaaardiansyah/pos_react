// tests/services/productService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — productService: validasi pembuatan produk (termasuk aturan
// harga grosir) dan penyesuaian stok atomik (in/out/adjustment).
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("../../models/productModel");
jest.mock("../../models/unitModel");
jest.mock("../../models/variantModel");
jest.mock("../../models/transactionModel");
jest.mock("../../models/settingModel");
// syncSelectionType() memanggil execute() dari config/database.js secara
// langsung (bukan lewat model) untuk UPDATE kolom selection_type — perlu
// di-mock juga supaya createProduct() tidak mencoba konek ke MySQL asli.
jest.mock("../../config/database");

const productModel = require("../../models/productModel");
const unitModel = require("../../models/unitModel");
const variantModel = require("../../models/variantModel");
const { execute } = require("../../config/database");
const { productService, ValidationError, NotFoundError } = require("../../services/productService");

beforeEach(() => {
  jest.clearAllMocks();
  productModel.existsByBarcode.mockResolvedValue(false);
  productModel.create.mockResolvedValue({ insertId: 1 });
  productModel.findByIdRaw.mockResolvedValue({ id: 1, name: "Produk Test" });
  productModel.addStockHistory.mockResolvedValue({});
  unitModel.findByProductId.mockResolvedValue([]);
  variantModel.findByProductId.mockResolvedValue([]);
  execute.mockResolvedValue({});
});

describe("productService.createProduct", () => {
  test("menolak jika barcode/nama/harga tidak lengkap", async () => {
    await expect(
      productService.createProduct({ barcode: "123", name: "" , price: 1000 }),
    ).rejects.toThrow("Barcode, nama, dan harga wajib diisi");
  });

  test("menolak barcode yang sudah dipakai produk lain", async () => {
    productModel.existsByBarcode.mockResolvedValueOnce(true);
    await expect(
      productService.createProduct({ barcode: "8991234", name: "Kopi", price: 15000 }),
    ).rejects.toThrow("Barcode sudah digunakan");
  });

  test("harga grosir diisi TANPA jumlah beli minimum: ditolak (mencegah data grosir tidak konsisten)", async () => {
    await expect(
      productService.createProduct({
        barcode: "111",
        name: "Beras 5kg",
        price: 65000,
        price_wholesale: 60000,
        // min_qty_wholesale sengaja tidak diisi
      }),
    ).rejects.toThrow("Isi jumlah beli minimum grosir");
  });

  test("harga grosir & jumlah beli minimum valid (>= 2): tersimpan apa adanya", async () => {
    await productService.createProduct({
      barcode: "111b",
      name: "Beras 5kg",
      price: 65000,
      price_wholesale: 60000,
      min_qty_wholesale: 3,
    });
    const callArg = productModel.create.mock.calls[0][0];
    expect(callArg.priceWholesale).toBe(60000);
    expect(callArg.minQtyWholesale).toBe(3);
  });

  test("jumlah beli minimum grosir < 2 tetap ditolak walau diisi", async () => {
    await expect(
      productService.createProduct({
        barcode: "111c",
        name: "Beras 5kg",
        price: 65000,
        price_wholesale: 60000,
        min_qty_wholesale: 1,
      }),
    ).rejects.toThrow("minimal 2");
  });

  test("harga grosil kosong/0: priceWholesale & minQtyWholesale ikut null (tidak dipaksakan)", async () => {
    await productService.createProduct({
      barcode: "112",
      name: "Gula 1kg",
      price: 15000,
      price_wholesale: 0,
    });
    const callArg = productModel.create.mock.calls[0][0];
    expect(callArg.priceWholesale).toBeNull();
    expect(callArg.minQtyWholesale).toBeNull();
  });

  test("stok awal > 0 tercatat sebagai riwayat stok masuk (reference: initial)", async () => {
    await productService.createProduct({
      barcode: "113",
      name: "Minyak Goreng",
      price: 20000,
      stock: 50,
    });
    expect(productModel.addStockHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 1,
        type: "in",
        quantity: 50,
        previousStock: 0,
        newStock: 50,
        reference: "initial",
      }),
    );
  });

  test("stok awal 0/tidak diisi: TIDAK membuat riwayat stok", async () => {
    await productService.createProduct({
      barcode: "114",
      name: "Sabun",
      price: 5000,
    });
    expect(productModel.addStockHistory).not.toHaveBeenCalled();
  });
});

describe("productService.updateStock (penyesuaian stok atomik)", () => {
  const user = { name: "Admin Toko" };

  test("menolak jenis perubahan stok yang tidak dikenal", async () => {
    await expect(
      productService.updateStock(1, { quantity: 5, type: "invalid" }, user),
    ).rejects.toThrow("Jenis perubahan stok tidak valid");
  });

  test("menolak jumlah non-numerik", async () => {
    await expect(
      productService.updateStock(1, { quantity: "abc", type: "in" }, user),
    ).rejects.toThrow("Jumlah harus berupa angka");
  });

  test("menolak jumlah <= 0 untuk tipe in/out", async () => {
    await expect(
      productService.updateStock(1, { quantity: 0, type: "in" }, user),
    ).rejects.toThrow("harus lebih besar dari 0");
  });

  test("menolak hasil penyesuaian (adjustment) bernilai negatif", async () => {
    await expect(
      productService.updateStock(1, { quantity: -5, type: "adjustment" }, user),
    ).rejects.toThrow("tidak boleh negatif");
  });

  test("tipe 'in': menambah stok sesuai jumlah", async () => {
    productModel.updateStockAtomic.mockImplementation(async (id, computeFn) => {
      const result = computeFn({ stock: 100 });
      expect(result.newStock).toBe(120);
      expect(result.historyType).toBe("in");
      return { id };
    });
    await productService.updateStock(1, { quantity: 20, type: "in" }, user);
    expect(productModel.updateStockAtomic).toHaveBeenCalledTimes(1);
  });

  test("tipe 'out': mengurangi stok, menolak jika hasilnya negatif (stok tidak mencukupi)", async () => {
    productModel.updateStockAtomic.mockImplementation(async (id, computeFn) => {
      expect(() => computeFn({ stock: 10 })).toThrow("Stok tidak mencukupi");
      return {};
    });
    await productService.updateStock(1, { quantity: 15, type: "out" }, user);
  });

  test("tipe 'out': berhasil mengurangi stok jika mencukupi", async () => {
    productModel.updateStockAtomic.mockImplementation(async (id, computeFn) => {
      const result = computeFn({ stock: 10 });
      expect(result.newStock).toBe(5);
      return { id };
    });
    await productService.updateStock(1, { quantity: 5, type: "out" }, user);
  });

  test("tipe 'adjustment': stok baru = nilai input (bukan penjumlahan/pengurangan)", async () => {
    productModel.updateStockAtomic.mockImplementation(async (id, computeFn) => {
      const result = computeFn({ stock: 999 });
      expect(result.newStock).toBe(30);
      return { id };
    });
    await productService.updateStock(1, { quantity: 30, type: "adjustment" }, user);
  });

  test("createdBy SELALU diambil dari user token (bukan dari body), fallback 'Admin' jika kosong", async () => {
    productModel.updateStockAtomic.mockResolvedValueOnce({ id: 1 });
    await productService.updateStock(1, { quantity: 5, type: "in" }, {});
    const opts = productModel.updateStockAtomic.mock.calls[0][2];
    expect(opts.createdBy).toBe("Admin");
  });

  test("melempar NotFoundError jika model menandai error status 404 (produk tidak ada)", async () => {
    const err = new Error("Produk tidak ditemukan");
    err.status = 404;
    productModel.updateStockAtomic.mockRejectedValueOnce(err);
    await expect(
      productService.updateStock(999, { quantity: 5, type: "in" }, user),
    ).rejects.toThrow(NotFoundError);
  });
});
