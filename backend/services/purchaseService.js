// services/purchaseService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — pencatatan pembelian stok dari supplier & laporan pembelian.
// ─────────────────────────────────────────────────────────────────────────────
const purchaseModel = require("../models/purchaseModel");
const { ValidationError, NotFoundError } = require("./productService");
const { toLocalDatetime, defaultDateRange } = require("./transactionService");
// FIX (revisi dosen #17): dibutuhkan supaya pembelian TUNAI ikut tertaut ke
// sesi kas aktif (kalau ada) — lihat komentar di recordPurchase() di bawah.
const cashRegisterModel = require("../models/cashRegisterModel");

function generatePurchaseCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `PRC${date}${rand}`;
}

// Kode faktur hutang untuk pembelian kredit — ditautkan ke purchase_code
// yang sudah unik, supaya tidak ada risiko tabrakan kode faktur (mirror
// dari generateInvoiceCodeFromTx di transactionService.js).
function generatePayableInvoiceCode(purchaseCode) {
  return `HUT-${purchaseCode}`;
}

// Jatuh tempo default hutang pembelian kredit: +30 hari dari tanggal
// pembelian (bisa ditimpa lewat field due_date pada payload).
function defaultDueDate(fromDate = new Date()) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + 30);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const purchaseService = {
  listSuppliers() {
    return purchaseModel.findAllSuppliers();
  },

  async createSupplier({ name, phone, address, notes }) {
    if (!name) throw new ValidationError("Nama supplier wajib diisi");
    const result = await purchaseModel.createSupplier({
      name,
      phone,
      address,
      notes,
    });
    return purchaseModel.findSupplierById(result.insertId);
  },

  async updateSupplier(id, patch) {
    const existing = await purchaseModel.findSupplierById(id);
    if (!existing) throw new NotFoundError("Supplier tidak ditemukan");
    await purchaseModel.updateSupplier(id, existing, {
      name: patch.name,
      phone: patch.phone,
      address: patch.address,
      notes: patch.notes,
      isActive: patch.is_active,
    });
    return purchaseModel.findSupplierById(id);
  },

  deleteSupplier(id) {
    return purchaseModel.deactivateSupplier(id);
  },

  async recordPurchase(payload, user) {
    const {
      items,
      supplier_id,
      supplier_name,
      purchase_date,
      notes,
      recorded_by,
      nota_url,
      nota_original_name,
      payment_method,
      due_date,
    } = payload;
    if (!items || items.length === 0)
      throw new ValidationError("Tidak ada produk dalam pembelian");

    // Validasi bentuk tiap item di sini (fail fast dengan pesan jelas)
    // sebelum masuk ke purchaseModel.createPurchase, yang akan menghitung
    // konversi satuan (purchase_unit_id → conversion_qty dari DB) & mengunci
    // baris produk di dalam DB transaction. `quantity`/`unit_cost` pada tiap
    // item TIDAK LAGI harus dalam satuan dasar — boleh dalam satuan beli apa
    // pun (mis. Karung) selama purchase_unit_id diisi; kalau tidak diisi,
    // berarti satuan dasar produk (perilaku lama, tetap didukung).
    for (const item of items) {
      if (!item.product_id)
        throw new ValidationError("product_id wajib diisi pada tiap item");
      if (!(Number(item.quantity) > 0))
        throw new ValidationError(
          `Jumlah untuk produk ID ${item.product_id} harus lebih dari 0`,
        );
      if (!(Number(item.unit_cost) >= 0))
        throw new ValidationError(
          `Harga beli untuk produk ID ${item.product_id} tidak valid`,
        );
    }

    // Cara bayar pembelian: 'tunai' (default, langsung Kas berkurang, tidak
    // membuat hutang) atau 'kredit' (Stok tetap bertambah, tapi membuat
    // faktur Hutang Supplier berstatus Belum Lunas — lihat purchaseModel).
    const paymentMethod = payment_method === "kredit" ? "kredit" : "tunai";
    if (paymentMethod === "kredit" && !supplier_name?.trim())
      throw new ValidationError(
        "Supplier wajib diisi untuk pembelian kredit (hutang)",
      );

    const purchaseCode = generatePurchaseCode();
    const occurredAt = toLocalDatetime();
    const purchaseDate = purchase_date || occurredAt.slice(0, 10);
    const resolvedDueDate =
      paymentMethod === "kredit" ? due_date || defaultDueDate() : null;

    // FIX (revisi dosen #17, disesuaikan dengan sesi kas per kasir):
    // pembelian TUNAI mengurangi Kas (1100) secara riil — kalau kasir yang
    // mencatat pembelian ini (user) sedang punya sesi kas terbuka, tautkan
    // pembelian ke sesi ITU (shift_id) supaya ikut dihitung saat dia tutup
    // kas. Kredit tidak menyentuh Kas sama sekali, jadi tidak pernah
    // ditautkan. findActiveShift(userId) sekarang per-kasir, bukan global
    // lagi — lihat catatan di cashRegisterModel.
    let shiftId = null;
    if (paymentMethod === "tunai") {
      const activeShift = await cashRegisterModel.findActiveShift(user?.id);
      shiftId = activeShift ? activeShift.id : null;
    }

    const purchase = await purchaseModel.createPurchase({
      items,
      supplierId: supplier_id,
      supplierName: supplier_name,
      purchaseCode,
      purchaseDate,
      notes,
      recordedBy: recorded_by,
      occurredAt,
      notaUrl: nota_url || null,
      notaOriginalName: nota_original_name || null,
      paymentMethod,
      dueDate: resolvedDueDate,
      payableInvoiceCode:
        paymentMethod === "kredit"
          ? generatePayableInvoiceCode(purchaseCode)
          : null,
      shiftId,
    });

    // Jurnal (Dr Persediaan, Cr Kas/Utang Usaha) sudah diposting di dalam
    // purchaseModel.createPurchase, dalam DB transaction yang sama dengan
    // pembelian & perubahan stok — lihat catatan desain di journalService.js.
    return purchase;
  },

  async list({
    start_date,
    end_date,
    supplier_id,
    search,
    page = 1,
    limit = 50,
  }) {
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const { total, rows } = await purchaseModel.findAll({
      startDate: start_date,
      endDate: end_date,
      supplierId: supplier_id,
      search,
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit,
    });
    return { data: rows, total, page: parsedPage, limit: parsedLimit };
  },

  async getDetail(id) {
    const purchase = await purchaseModel.findById(id);
    if (!purchase) throw new NotFoundError("Pembelian tidak ditemukan");
    const items = await purchaseModel.findItemsByPurchaseId(id);
    return { ...purchase, items };
  },

  async report({ start_date, end_date, period = "daily" }) {
    const { startDate, endDate } = defaultDateRange(start_date, end_date);
    const [periodData, summary, topProducts, perSupplier] = await Promise.all([
      purchaseModel.reportByPeriod(period, startDate, endDate),
      purchaseModel.reportSummary(startDate, endDate),
      purchaseModel.reportTopProducts(startDate, endDate),
      purchaseModel.reportPerSupplier(startDate, endDate),
    ]);
    return {
      summary,
      periodData,
      topProducts,
      perSupplier,
      startDate,
      endDate,
      period,
    };
  },

  async expiredReport({ start_date, end_date, status, threshold_days = 30 }) {
    const thresholdDays = Number(threshold_days) || 30;
    const [items, summary] = await Promise.all([
      purchaseModel.reportExpiredItems({
        startDate: start_date,
        endDate: end_date,
        status,
        thresholdDays,
      }),
      purchaseModel.reportExpiredSummary({
        startDate: start_date,
        endDate: end_date,
        thresholdDays,
      }),
    ]);
    return { items, summary, thresholdDays };
  },

  async dashboard() {
    const [thisMonth, lastMonth, recentPurchases, topProductsMonth] =
      await Promise.all([
        purchaseModel.dashboardThisMonth(),
        purchaseModel.dashboardLastMonth(),
        purchaseModel.dashboardRecent(),
        purchaseModel.dashboardTopProductsThisMonth(),
      ]);
    return { thisMonth, lastMonth, recentPurchases, topProductsMonth };
  },

  async deletePurchase(id) {
    const purchase = await purchaseModel.findById(id);
    if (!purchase) throw new NotFoundError("Pembelian tidak ditemukan");
    if (purchase.status === "confirmed")
      throw new ValidationError(
        "Pembelian yang sudah dikonfirmasi tidak dapat dihapus",
      );
    await purchaseModel.deletePurchase(id);
  },
};

module.exports = purchaseService;
