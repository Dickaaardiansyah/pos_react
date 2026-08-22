// services/purchaseService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — pencatatan pembelian stok dari supplier & laporan pembelian.
// ─────────────────────────────────────────────────────────────────────────────
const purchaseModel = require("../models/purchaseModel");
const { ValidationError, NotFoundError } = require("./productService");
const { toLocalDatetime, defaultDateRange } = require("./transactionService");
// FIX (revisi dosen #17): dibutuhkan supaya pembelian TUNAI ikut tertaut ke
// sesi kas aktif (kalau ada) — lihat komentar di recordPurchase() di bawah.
// Dipakai (bukan cashRegisterModel langsung) supaya sekalian dapat
// expected_balance sesi itu (buildShiftSummary), dibutuhkan untuk validasi
// saldo Kas Laci sebelum pembelian tunai — lihat blok "Sumber Dana" di bawah.
const cashRegisterService = require("./cashRegisterService");
// Dibutuhkan untuk validasi saldo Kas/Bank Kantor (bukan laci) sebelum
// pembelian tunai — lihat journalService.getCurrentBalance().
const journalService = require("./journalService");

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function formatRupiah(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

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
      nota_url,
      nota_original_name,
      payment_method,
      payment_source,
      target_account,
      shift_id,
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
    // pembelian TUNAI mengurangi Kas (1100) secara riil — kalau pembelian
    // ditautkan ke sesi kas yang sedang terbuka (shift_id), transaksi ini
    // ikut dihitung saat sesi itu tutup kas. Kredit tidak menyentuh Kas
    // sama sekali, jadi tidak pernah ditautkan.
    //
    // Sumber Dana (baru): pembelian TUNAI sekarang wajib pilih dari mana
    // uangnya — 'laci' (sesi kas kasir yang sedang terbuka) atau 'kantor'
    // (Kas besar / Bank toko, tidak tertaut ke laci manapun). Sebelum ini,
    // pembelian tunai SELALU boleh dicatat berapa pun saldo yang tersedia —
    // sekarang ditolak dengan pesan jelas ("saldo tidak cukup") kalau saldo
    // sumber dana yang dipilih lebih kecil dari total pembelian, supaya
    // saldo Kas/Laci/Bank tidak bisa minus gara-gara pencatatan pembelian.
    //
    // FIX (revisi dosen #14): saat "laci" diperkenalkan di atas, resolusi
    // shift-nya masih lewat cashRegisterService.getActiveShift(user) — yaitu
    // "sesi kas MILIK user yang sedang login". Tapi route pembelian ini
    // admin-only (purchase.routes.js), sedangkan buka sesi kas khusus kasir
    // (cashRegister.routes.js): admin TIDAK PERNAH punya sesi kas sendiri,
    // jadi getActiveShift(admin) SELALU null — opsi "laci" jadi selalu gagal
    // dengan pesan "Tidak ada sesi kas terbuka", padahal bisa saja SEDANG
    // ADA kasir yang shift-nya aktif.
    //
    // Sekarang: kalau CUMA ADA SATU laci kasir yang sedang terbuka di toko
    // (kasus paling umum — satu terminal, satu kasir bertugas), itu dipakai
    // otomatis — admin tidak perlu pilih apa-apa, cukup pilih Sumber Dana =
    // "Laci". payload.shift_id BARU wajib diisi (dari dropdown "Pilih Laci
    // Kasir" — lihat cashRegisterService.listOpenShifts()) kalau ADA LEBIH
    // DARI SATU laci terbuka bersamaan (beberapa kasir shift barengan) —
    // di situ admin memang harus tegaskan laci fisik mana yang uangnya
    // berkurang, supaya tidak salah tautkan ke laci kasir yang salah.
    // Tidak ada langkah "persetujuan" dari kasir pemilik laci — cukup
    // tertaut & tercatat, karena riwayatnya sudah otomatis terlihat oleh
    // kasir itu sendiri di Kas Berjalan/Riwayat Tutup Kas miliknya
    // (akuntabilitas lewat jejak audit, bukan lewat approval gate).
    //
    // shiftUserId yang diteruskan ke purchaseModel diambil dari PEMILIK ASLI
    // shift ini (activeShift.opened_by_user_id), BUKAN user?.id (admin) —
    // supaya validasi kepemilikan di lockOpenShift() (row lock + re-cek
    // status 'open' di dalam transaction) tetap bermakna, bukan cuma
    // dilewati/dipalsukan dengan id admin.
    let shiftId = null;
    let shiftOwnerId = null;
    if (paymentMethod === "tunai") {
      const paymentSource = payment_source === "kantor" ? "kantor" : "laci";
      // Estimasi total biaya dari payload (SAMA dengan totalCost final yang
      // dihitung ulang di purchaseModel.createPurchase dari qty x unit_cost
      // per baris — konversi satuan tidak mengubah nilai ini, cuma qty
      // stok dasarnya, lihat catatan di purchaseModel). Dipakai di sini
      // (sebelum DB transaction) supaya penolakan saldo tidak cukup bisa
      // langsung dicek tanpa mengunci baris produk dulu.
      const estimatedTotalCost = round2(
        items.reduce(
          (sum, it) => sum + Number(it.quantity) * Number(it.unit_cost),
          0,
        ),
      );

      if (paymentSource === "laci") {
        let activeShift;
        if (shift_id) {
          activeShift = await cashRegisterService.getOpenShiftById(shift_id);
          if (!activeShift) {
            throw new ValidationError(
              'Sesi kas (laci) yang dipilih tidak ditemukan atau sudah ditutup. Pilih laci lain yang masih terbuka, atau pilih sumber dana "Kas/Bank Kantor".',
            );
          }
        } else {
          const openShifts = await cashRegisterService.listOpenShifts();
          if (openShifts.length === 0) {
            throw new ValidationError(
              'Tidak ada sesi kas (laci) yang sedang terbuka saat ini. Buka sesi kas dulu, atau pilih sumber dana "Kas/Bank Kantor".',
            );
          }
          if (openShifts.length > 1) {
            throw new ValidationError(
              "Ada lebih dari satu laci kasir yang sedang terbuka saat ini. Pilih laci mana yang dipakai supaya jelas laci fisik yang uangnya berkurang.",
            );
          }
          activeShift = openShifts[0];
        }
        if (Number(activeShift.expected_balance) < estimatedTotalCost) {
          throw new ValidationError(
            `Saldo Kas Laci "${activeShift.cashier_name || activeShift.opened_by}" tidak cukup untuk pembelian ini. Saldo laci saat ini Rp ${formatRupiah(activeShift.expected_balance)}, dibutuhkan Rp ${formatRupiah(estimatedTotalCost)}.`,
          );
        }
        shiftId = activeShift.id;
        shiftOwnerId = activeShift.opened_by_user_id ?? null;
      } else {
        const targetAccount = target_account === "bank" ? "bank" : "kas";
        const accountCode =
          targetAccount === "bank"
            ? journalService.ACC.BANK
            : journalService.ACC.KAS;
        const currentBalance = await journalService.getCurrentBalance(
          accountCode,
          purchaseDate,
        );
        if (currentBalance < estimatedTotalCost) {
          const label = targetAccount === "bank" ? "Bank" : "Kas Kantor";
          throw new ValidationError(
            `Saldo ${label} tidak cukup untuk pembelian ini. Saldo saat ini Rp ${formatRupiah(currentBalance)}, dibutuhkan Rp ${formatRupiah(estimatedTotalCost)}.`,
          );
        }
        // shiftId TETAP null di sini — pembelian dari Kas/Bank Kantor
        // sengaja tidak ditautkan ke laci kasir manapun (lihat catatan
        // skop "uang di laci kasir" vs "kas besar/bank" di
        // cashRegisterService.js).
      }
    }

    const purchase = await purchaseModel.createPurchase({
      items,
      supplierId: supplier_id,
      supplierName: supplier_name,
      purchaseCode,
      purchaseDate,
      notes,
      // FIX (revisi dosen #15): recordedBy TIDAK LAGI dibaca dari payload
      // (client-controlled, bisa dipalsukan bebas walau endpoint admin-only)
      // — sekarang selalu dari identitas sesi (req.user) yang divalidasi
      // server-side lewat auth middleware. recordedByUserId (FK ke users)
      // ikut disimpan sebagai referensi asli di samping snapshot nama, jadi
      // audit trail tetap valid walau nama user berubah/di-rename kemudian.
      recordedBy: user?.name || "Admin",
      recordedByUserId: user?.id ?? null,
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
      // FIX (revisi dosen #14): shiftUserId sekarang PEMILIK ASLI shift
      // (shiftOwnerId, dari activeShift.opened_by_user_id di atas), BUKAN
      // user?.id (admin yang login) — supaya lockOpenShift() di
      // purchaseModel memvalidasi kepemilikan terhadap kasir yang
      // sebenarnya memegang laci itu. Kalau shiftId null (Kas/Bank Kantor),
      // shiftOwnerId juga null dan lockOpenShift() no-op seperti biasa.
      shiftUserId: shiftOwnerId,
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
