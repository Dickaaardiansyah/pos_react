// services/productService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — aturan bisnis produk & kategori: validasi, kombinasi query,
// dan penerapan hukum-hukum sederhana (mis. barcode harus unik, stok tidak
// boleh minus). Controller memanggil service, service memanggil model.
// ─────────────────────────────────────────────────────────────────────────────
const productModel = require("../models/productModel");
const unitModel = require("../models/unitModel");
const variantModel = require("../models/variantModel");
const transactionModel = require("../models/transactionModel");
const settingModel = require("../models/settingModel");

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.status = 404;
  }
}

// Harga grosir tanpa syarat jumlah beli minimum tidak masuk akal — kalau
// harga grosir diisi, jumlah beli minimum wajib ikut diisi (>= 2). Dipakai
// baik untuk satuan dasar produk (products.price_wholesale) maupun untuk
// tiap satuan tambahan (product_units.price_wholesale, lihat saveAdditionalUnits).
function resolveWholesaleThreshold(rawPriceWholesale, rawMinQty, label) {
  const priceWholesale =
    rawPriceWholesale === "" ||
    rawPriceWholesale === null ||
    rawPriceWholesale === undefined
      ? null
      : Number(rawPriceWholesale);
  if (!priceWholesale || priceWholesale <= 0) {
    return { priceWholesale: null, minQtyWholesale: null };
  }
  const minQtyWholesale =
    rawMinQty === "" || rawMinQty === null || rawMinQty === undefined
      ? null
      : Number(rawMinQty);
  if (!minQtyWholesale || minQtyWholesale < 2) {
    throw new ValidationError(
      `Isi jumlah beli minimum grosir untuk ${label} (minimal 2)`,
    );
  }
  return { priceWholesale, minQtyWholesale };
}

// Menyimpan satuan tambahan + konversi suatu produk (mis. 1 BOX = 12 PCS),
// relatif terhadap satuan dasar produk (kolom `unit`). Dipanggil dari
// createProduct/updateProduct — payload `additional_units` bersifat opsional;
// kalau tidak dikirim sama sekali, daftar satuan tambahan yang sudah ada
// TIDAK disentuh (supaya update parsial, mis. hanya ganti harga, tidak
// menghapus konfigurasi satuan yang sudah diisi sebelumnya).
async function saveAdditionalUnits(productId, additionalUnits) {
  if (!Array.isArray(additionalUnits)) return;

  await unitModel.deleteByProductId(productId);
  const seenUnitIds = new Set();
  for (const row of additionalUnits) {
    const unitId = Number(row.unit_id);
    const conversionQty = Number(row.conversion_qty);
    if (!unitId || !conversionQty || conversionQty <= 0) continue;
    if (seenUnitIds.has(unitId)) continue; // satu produk tidak boleh punya satuan yang sama dua kali
    seenUnitIds.add(unitId);

    // Harga jual untuk satuan ini (mis. harga per BOX) — wajib diisi supaya
    // kasir bisa menjual satuan ini, sama seperti "Def. Hrg Jual Satuan #1/#2"
    // di form Barang & Jasa referensi. Harga grosir per satuan opsional.
    // Pengecualian: purchase_only=true (mis. "Karung" yang cuma dipakai untuk
    // konversi Pembelian, bukan dijual ke pembeli) boleh tanpa harga jual.
    const purchaseOnly = !!row.purchase_only;
    const price = Number(row.price);
    if (!purchaseOnly && (!price || price <= 0)) continue;
    let priceWholesale =
      row.price_wholesale === "" ||
      row.price_wholesale === null ||
      row.price_wholesale === undefined
        ? null
        : Number(row.price_wholesale);

    // Harga grosir tanpa syarat jumlah beli tidak masuk akal (kapan berlakunya
    // jadi tidak jelas) — kalau harga grosir diisi, jumlah beli minimum WAJIB
    // ikut diisi (minimal 2, karena grosir hanya masuk akal untuk pembelian
    // lebih dari 1). Kalau harga grosirnya 0/kosong, syarat jumlah diabaikan.
    let minQtyWholesale =
      row.min_qty_wholesale === "" ||
      row.min_qty_wholesale === null ||
      row.min_qty_wholesale === undefined
        ? null
        : Number(row.min_qty_wholesale);
    if (priceWholesale && priceWholesale > 0) {
      if (!minQtyWholesale || minQtyWholesale < 2) {
        throw new ValidationError(
          `Isi jumlah beli minimum grosir untuk satuan "${row.unit_name}" (minimal 2)`,
        );
      }
    } else {
      priceWholesale = null;
      minQtyWholesale = null;
    }

    await unitModel.insertProductUnit({
      productId,
      unitId,
      conversionQty,
      price: purchaseOnly && (!price || price <= 0) ? null : price,
      priceWholesale,
      minQtyWholesale,
      purchaseOnly,
    });
  }
}

/**
 * Samakan selection_type dengan data opsi:
 * - payload.selection_type eksplisit menang
 * - kalau ada additional_units → 'unit'
 * - kalau tidak dan bukan variant → 'none'
 */
async function syncSelectionType(productId, payload) {
  const { execute } = require("../config/database");
  let type = payload.selection_type;
  if (!type || !["none", "variant", "unit"].includes(type)) {
    const units = await unitModel.findByProductId(productId);
    const sellableUnits = (units || []).filter((u) => !u.purchase_only);
    const variants = await variantModel.findByProductId(productId);
    if (sellableUnits.length > 0) type = "unit";
    else if (variants && variants.length > 0) type = "variant";
    else type = "none";
  }
  try {
    await execute("UPDATE products SET selection_type = ? WHERE id = ?", [
      type,
      productId,
    ]);
  } catch (e) {
    if (!/Unknown column/i.test(e.message || "")) throw e;
  }
}

/**
 * Simpan ulang daftar varian produk (replace-all).
 * Baris kosong diabaikan. selection_type diset lewat syncSelectionType.
 */
async function saveVariants(productId, variants) {
  await variantModel.deleteByProductId(productId);
  if (!Array.isArray(variants)) return;
  for (const row of variants) {
    const name = (row.name || "").trim();
    const price = Number(row.price);
    if (!name || !price || price <= 0) continue;

    let priceWholesale =
      row.price_wholesale === "" ||
      row.price_wholesale === null ||
      row.price_wholesale === undefined
        ? null
        : Number(row.price_wholesale);
    let minQtyWholesale =
      row.min_qty_wholesale === "" ||
      row.min_qty_wholesale === null ||
      row.min_qty_wholesale === undefined
        ? null
        : Number(row.min_qty_wholesale);
    if (priceWholesale && priceWholesale > 0) {
      if (!minQtyWholesale || minQtyWholesale < 2) {
        throw new ValidationError(
          `Isi jumlah beli minimum grosir untuk varian "${name}" (minimal 2)`,
        );
      }
    } else {
      priceWholesale = null;
      minQtyWholesale = null;
    }

    const barcode = (row.barcode || "").trim() || null;
    if (barcode) {
      const exists = await variantModel.existsByBarcode(barcode);
      if (exists) {
        throw new ValidationError(
          `Barcode varian "${barcode}" sudah digunakan`,
        );
      }
    }

    await variantModel.insertVariant({
      productId,
      name,
      price,
      priceWholesale,
      minQtyWholesale,
      barcode,
      sku: (row.sku || "").trim() || null,
    });
  }
}

function round3(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

// Safety Stock & Reorder Point adalah "berapa unit harus ada di rak/dipesan"
// — angka ini HARUS bulat, karena tidak ada toko yang restock "0,016 botol".
// Dibulatkan KE ATAS (bukan dibulatkan biasa) supaya tetap aman: kalau hasil
// hitungan menunjukkan ada kebutuhan sekecil apa pun (>0), tetap dianggap
// butuh minimal 1 unit — bukan malah dibulatkan ke bawah jadi 0 dan bikin
// toko kehabisan stok. rata-rata jual (avgSalesPerUnit) TIDAK ikut dibulatkan
// ke atas karena itu laju (rate), bukan jumlah unit — presisi di situ penting
// untuk keakuratan hitungan (terutama produk satuan pecahan, mis. kg).
function ceilQty(n) {
  const x = Number(n) || 0;
  if (x <= 0) return 0;
  return Math.ceil(x);
}

// Pemilihan periode ROP otomatis ("Opsi A"):
//  - data < 14 hari  → pakai semua data yang ada (sedikit lebih baik
//    daripada memaksa jendela 14/30 hari yang datanya kosong)
//  - data 14–45 hari → pakai 14 hari (cukup responsif, tidak terlalu bising)
//  - data > 45 hari  → pakai 30 hari (paling stabil untuk toko pada umumnya)
//
// `availableDays` = jumlah hari sejak transaksi completed paling awal.
// 0 (belum ada transaksi sama sekali) tetap dianggap "pakai semua data
// yang ada" — hasilnya nanti tetap 0 penjualan, itu wajar untuk toko baru.
function pickReorderWindow(availableDays) {
  const avail = Number(availableDays) || 0;
  if (avail > 0 && avail < 14) {
    return { windowDays: avail, periodMode: "auto", availableDays: avail };
  }
  if (avail >= 14 && avail <= 45) {
    return { windowDays: 14, periodMode: "auto", availableDays: avail };
  }
  return { windowDays: 30, periodMode: "auto", availableDays: avail };
}

const DEFAULT_STORE_OPERATING_HOURS = 10;

// Rumus Reorder Point (lihat Bab 2.1.10 — Reorder Point, Lead Time, Safety Stock).
// Mendukung dua satuan waktu:
//
//  Versi HARI (timeUnit = "hari"):
//    d   = rata-rata penjualan harian (satuan dasar)
//    LT  = lead time (hari)
//    HC  = hari cadangan
//    SS  = HC x d                  (Safety Stock, dibulatkan ke atas)
//    ROP = (d x LT) + SS           (Reorder Point, dibulatkan ke atas)
//
//  Versi JAM (timeUnit = "jam"):
//    d_jam = rata-rata penjualan harian / jam operasional toko per hari
//    LT    = lead time (jam)
//    HC    = jam cadangan
//    SS    = HC x d_jam            (dibulatkan ke atas)
//    ROP   = (d_jam x LT) + SS     (dibulatkan ke atas)
//
// Catatan pembulatan: SS & ROP mewakili "berapa unit" (jumlah barang), jadi
// selalu dibulatkan KE ATAS ke bilangan bulat — tidak ada toko yang restock
// pecahan botol/pcs. d (rata-rata jual) TIDAK dibulatkan ke atas karena itu
// laju (rate), bukan jumlah unit — presisi 3 desimal dipertahankan supaya
// hitungan tetap akurat, terutama untuk produk bersatuan pecahan (mis. kg).
function calculateReorderPoint({
  avgDailySales,
  leadTimeValue,
  safetyStockValue,
  timeUnit,
  storeHoursPerDay,
}) {
  const dailyAvg = Number(avgDailySales) || 0;
  const lt = Number(leadTimeValue) || 0;
  const hc = Number(safetyStockValue) || 0;
  const unit = timeUnit === "jam" ? "jam" : "hari";

  const hours =
    Number(storeHoursPerDay) > 0
      ? Number(storeHoursPerDay)
      : DEFAULT_STORE_OPERATING_HOURS;
  // d = rata-rata penjualan per satuan waktu yang dipilih (per hari, atau
  // per jam kalau unit = "jam" — dibagi jam operasional toko per hari).
  const d = unit === "jam" ? dailyAvg / hours : dailyAvg;

  const safetyStock = ceilQty(hc * d);
  const reorderPoint = ceilQty(d * lt + hc * d);
  return {
    avgSalesPerUnit: round3(d),
    safetyStock,
    reorderPoint,
    timeUnit: unit,
  };
}

const productService = {
  async listProducts({ category, search, low_stock }) {
    const products = await productModel.findAll({
      categoryId: category,
      search,
      lowStockOnly: low_stock === "true",
    });
    // Lampirkan satuan tambahan supaya kasir tahu produk mana yang
    // perlu dropdown/popup satuan tanpa request per-item.
    if (!products.length) return products;
    await Promise.all(
      products.map(async (p) => {
        p.additional_units = await unitModel.findByProductId(p.id);
        p.variants = await variantModel.findByProductId(p.id);
        // Auto: punya satuan tambahan → treat sebagai selection unit
        // (tetap hormati nilai eksplisit 'variant').
        if (
          (!p.selection_type || p.selection_type === "none") &&
          p.additional_units &&
          p.additional_units.length > 0
        ) {
          p.selection_type = "unit";
        }
      }),
    );
    return products;
  },

  async getByBarcode(barcode) {
    const product = await productModel.findByBarcode(barcode);
    if (!product) throw new NotFoundError("Produk tidak ditemukan");
    product.additional_units = await unitModel.findByProductId(product.id);
    product.variants = await variantModel.findByProductId(product.id);
    if (
      (!product.selection_type || product.selection_type === "none") &&
      product.additional_units &&
      product.additional_units.length > 0
    ) {
      product.selection_type = "unit";
    }
    return product;
  },

  async getById(id) {
    const product = await productModel.findById(id);
    if (!product) throw new NotFoundError("Produk tidak ditemukan");
    product.additional_units = await unitModel.findByProductId(id);
    try {
      const variantModel = require("../models/variantModel");
      product.variants = await variantModel.findByProductId(id);
    } catch {
      product.variants = [];
    }
    return product;
  },

  async createProduct(payload) {
    const { barcode, name, price } = payload;
    if (!barcode || !name || !price)
      throw new ValidationError("Barcode, nama, dan harga wajib diisi");

    const duplicate = await productModel.existsByBarcode(barcode);
    if (duplicate) throw new ValidationError("Barcode sudah digunakan");

    const { priceWholesale, minQtyWholesale } = resolveWholesaleThreshold(
      payload.price_wholesale,
      payload.min_qty_wholesale,
      `satuan dasar "${payload.unit || ""}"`,
    );

    const result = await productModel.create({
      barcode,
      name,
      description: payload.description,
      categoryId: payload.category_id,
      price: payload.price,
      priceWholesale,
      minQtyWholesale,
      costPrice: payload.cost_price,
      stock: payload.stock,
      minStock: payload.min_stock,
      leadTimeValue: payload.lead_time_value,
      safetyStockValue: payload.safety_stock_value,
      ropTimeUnit: payload.rop_time_unit,
      unit: payload.unit,
    });

    const initialStock = Number(payload.stock) || 0;
    if (initialStock > 0) {
      await productModel.addStockHistory({
        productId: result.insertId,
        type: "in",
        quantity: initialStock,
        previousStock: 0,
        newStock: initialStock,
        reference: "initial",
        notes: "Stok awal",
      });
    }
    await saveAdditionalUnits(result.insertId, payload.additional_units);
    await saveVariants(result.insertId, payload.variants);
    await syncSelectionType(result.insertId, payload);
    return productModel.findByIdRaw(result.insertId);
  },

  async updateProduct(id, payload) {
    const existing = await productModel.findByIdRaw(id);
    if (!existing) throw new NotFoundError("Produk tidak ditemukan");

    let priceWholesalePatch, minQtyWholesalePatch;
    if (payload.price_wholesale !== undefined) {
      const resolved = resolveWholesaleThreshold(
        payload.price_wholesale,
        payload.min_qty_wholesale,
        `satuan dasar "${payload.unit || existing.unit || ""}"`,
      );
      priceWholesalePatch = resolved.priceWholesale;
      minQtyWholesalePatch = resolved.minQtyWholesale;
    }

    await productModel.update(id, existing, {
      barcode: payload.barcode,
      name: payload.name,
      description: payload.description,
      categoryId:
        payload.category_id !== undefined ? payload.category_id : undefined,
      price: payload.price,
      priceWholesale: priceWholesalePatch,
      minQtyWholesale: minQtyWholesalePatch,
      costPrice: payload.cost_price,
      minStock: payload.min_stock,
      leadTimeValue: payload.lead_time_value,
      safetyStockValue: payload.safety_stock_value,
      ropTimeUnit: payload.rop_time_unit,
      unit: payload.unit,
      isActive: payload.is_active,
    });
    await saveAdditionalUnits(id, payload.additional_units);
    await saveVariants(id, payload.variants);
    await syncSelectionType(id, payload);
    return productModel.findByIdRaw(id);
  },

  async updateStock(id, { quantity, type, notes, recorded_by }) {
    const product = await productModel.findByIdRaw(id);
    if (!product) throw new NotFoundError("Produk tidak ditemukan");

    let newStock;
    if (type === "adjustment") newStock = quantity;
    else if (type === "in") newStock = product.stock + quantity;
    else if (type === "out") {
      newStock = product.stock - quantity;
      if (newStock < 0) throw new ValidationError("Stok tidak mencukupi");
    } else {
      throw new ValidationError("Jenis perubahan stok tidak valid");
    }

    await productModel.updateStockValue(id, newStock);
    await productModel.addStockHistory({
      productId: id,
      type,
      quantity,
      previousStock: product.stock,
      newStock,
      notes,
      reference: "manual",
      createdBy: recorded_by || "Admin",
    });
    return productModel.findByIdRaw(id);
  },

  async deleteProduct(id) {
    const product = await productModel.findByIdRaw(id);
    if (!product) throw new NotFoundError("Produk tidak ditemukan");
    await productModel.softDelete(id);
  },

  getStockHistory(id) {
    return productModel.findStockHistory(id);
  },

  // Rekomendasi restock berbasis Reorder Point. `days` menentukan jendela
  // histori penjualan yang dipakai untuk rata-rata penjualan harian (d).
  //
  // Mode PERIODE:
  //  - `days` diisi angka (7/14/30/60/90, dari dropdown "Ubah periode")
  //    → dipakai apa adanya (mode manual, override sistem).
  //  - `days` kosong / "auto" → sistem yang memilih (mode otomatis, lihat
  //    pickReorderWindow di bawah): periode terbaik berdasarkan berapa
  //    hari histori penjualan yang benar-benar tersedia di toko ini.
  //
  // Produk yang rop_time_unit-nya "jam" dikonversi memakai jam operasional
  // toko (setting 'store_operating_hours', default 10 jam).
  async listReorderPoints({ days } = {}) {
    const isManual =
      days !== undefined && days !== null && days !== "" && days !== "auto";
    const manualDays = isManual ? Number(days) : null;

    // Periode otomatis butuh tahu rentang histori penjualan toko lebih
    // dulu — hanya query kalau memang mode otomatis, supaya mode manual
    // (dropdown lama) tetap seringan sebelumnya.
    const availableDays =
      isManual && manualDays > 0
        ? null
        : await transactionModel.getSalesHistorySpanDays();

    const {
      windowDays,
      periodMode,
      availableDays: historyDays,
    } = isManual && manualDays > 0
      ? { windowDays: manualDays, periodMode: "manual", availableDays }
      : pickReorderWindow(availableDays);

    const [products, salesRows, storeHoursSetting] = await Promise.all([
      productModel.findAllWithLeadTime(),
      transactionModel.avgDailySalesByProduct(windowDays),
      settingModel.findAllSettings(),
    ]);

    const storeHoursRow = storeHoursSetting.find(
      (s) => s.key === "store_operating_hours",
    );
    const storeHoursPerDay = storeHoursRow
      ? Number(storeHoursRow.value) || DEFAULT_STORE_OPERATING_HOURS
      : DEFAULT_STORE_OPERATING_HOURS;

    const salesByProduct = new Map(
      salesRows.map((r) => [r.product_id, Number(r.avg_daily_qty) || 0]),
    );

    const items = products.map((p) => {
      const { avgSalesPerUnit, safetyStock, reorderPoint, timeUnit } =
        calculateReorderPoint({
          avgDailySales: salesByProduct.get(p.id) || 0,
          leadTimeValue: p.lead_time_value,
          safetyStockValue: p.safety_stock_value,
          timeUnit: p.rop_time_unit,
          storeHoursPerDay,
        });
      const stock = Number(p.stock) || 0;
      return {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        unit: p.unit,
        category_name: p.category_name,
        stock,
        min_stock: Number(p.min_stock) || 0,
        lead_time_value: Number(p.lead_time_value) || 0,
        safety_stock_value: Number(p.safety_stock_value) || 0,
        rop_time_unit: timeUnit,
        avg_sales_per_unit: avgSalesPerUnit,
        safety_stock: safetyStock,
        reorder_point: reorderPoint,
        needs_reorder: stock <= reorderPoint,
        window_days: windowDays,
        store_operating_hours: storeHoursPerDay,
      };
    });

    // `meta` menjelaskan periode yang dipakai untuk seluruh daftar ini —
    // dipakai frontend untuk teks "Dihitung dari rata-rata X hari terakhir"
    // dan untuk tahu apakah periode ini dipilih sistem (auto) atau user
    // (manual, dari dropdown "Ubah periode").
    return {
      items,
      meta: {
        window_days: windowDays,
        period_mode: periodMode,
        available_days: historyDays,
      },
    };
  },

  listCategories() {
    return productModel.findAllCategories();
  },

  async createCategory({ name, description }) {
    if (!name) throw new ValidationError("Nama kategori wajib diisi");
    const result = await productModel.createCategory(name, description);
    return productModel.findCategoryById(result.insertId);
  },

  // Kategori boleh dihapus meski masih dipakai produk — FK category_id
  // sudah ON DELETE SET NULL, jadi produk yang tadinya pakai kategori ini
  // otomatis jadi "Tanpa Kategori", tidak ikut terhapus.
  async deleteCategory(id) {
    const category = await productModel.findCategoryById(id);
    if (!category) throw new NotFoundError("Kategori tidak ditemukan");
    const { total } = await productModel.countProductsByCategory(id);
    await productModel.deleteCategory(id);
    return { affectedProducts: total || 0 };
  },
};

module.exports = { productService, ValidationError, NotFoundError };
