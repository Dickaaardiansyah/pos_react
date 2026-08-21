// services/payableService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — aturan bisnis Hutang: mirror dari receivableService.js,
// arahnya kebalik (kita berhutang ke supplier, bukan pelanggan berhutang
// ke kita).
// ─────────────────────────────────────────────────────────────────────────────
const payableModel = require("../models/payableModel");
const purchaseModel = require("../models/purchaseModel");
const { ValidationError, NotFoundError } = require("./productService");
// Dibutuhkan untuk validasi saldo Kas Laci (expected_balance sesi aktif,
// lewat buildShiftSummary) sebelum pembayaran hutang — lihat recordPayment()
// & pola yang sama di purchaseService.recordPurchase().
const cashRegisterService = require("./cashRegisterService");
// Dibutuhkan untuk validasi saldo Kas/Bank Kantor (bukan laci) sebelum
// pembayaran hutang — lihat journalService.getCurrentBalance().
const journalService = require("./journalService");

function computeStatus(amount, paidAmount) {
  if (paidAmount <= 0) return "belum_lunas";
  if (paidAmount >= amount) return "lunas";
  return "sebagian";
}

function formatRupiah(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

function generateInvoiceCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `HUT-${y}${m}${d}-${rand}`;
}

const payableService = {
  list({ status, supplier_id, search, overdue_only, page, limit }) {
    const params = {
      status,
      supplierId: supplier_id,
      search,
      overdueOnly: overdue_only === "true",
    };
    if (!limit) return payableModel.findAll(params);
    const parsedLimit = parseInt(limit) || 20;
    const parsedPage = parseInt(page) || 1;
    return payableModel.findAll({
      ...params,
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit,
    });
  },

  async getById(id) {
    const payable = await payableModel.findById(id);
    if (!payable) throw new NotFoundError("Hutang tidak ditemukan");
    const payments = await payableModel.findPayments(id);

    // Kalau faktur ini berasal dari pembelian kredit di menu Pembelian,
    // sertakan juga daftar barang (nama produk, qty, harga modal) supaya
    // bisa dicek kesesuaiannya dengan barang yang diterima dari supplier.
    // Mirror dari receivableService.getById().
    let items = [];
    if (payable.purchase_id) {
      items = await purchaseModel.findItemsByPurchaseId(payable.purchase_id);
    }

    return { ...payable, payments, items };
  },

  // FIX (revisi dosen #11): create() sebelumnya menerima paid_amount dari
  // client dan menyimpannya langsung di baris hutang, TAPI jurnal yang
  // diposting payableModel.create() cuma untuk NILAI PENUH (Dr Saldo Awal,
  // Cr Utang Usaha) — tidak ada jurnal/record pembayaran kedua untuk porsi
  // paid_amount (Dr Utang, Cr Kas). Akibatnya subledger (amount-paid_amount)
  // bisa berbeda dari saldo GL Utang Usaha sejak baris ini dibuat.
  //
  // Opsi yang dipilih: hutang manual SELALU dibuat dengan paid_amount = 0,
  // input paid_amount dari client diabaikan sepenuhnya. Seluruh pembayaran —
  // termasuk pembayaran awal/DP saat hutang baru dicatat — wajib lewat
  // recordPayment() di bawah, supaya SETIAP pembayaran selalu tercermin
  // sebagai baris payable_payments + jurnal Dr Utang/Cr Kas yang utuh, dan
  // audit trail-nya bersih (satu jalur, bukan dua jalur berbeda untuk kasus
  // "dibayar saat dibuat" vs "dibayar belakangan").
  async create(payload) {
    const {
      supplier_name,
      supplier_id,
      amount,
      due_date,
      invoice_date,
      notes,
      recorded_by,
      purchase_id,
    } = payload;

    if (!supplier_name || !supplier_name.trim())
      throw new ValidationError("Nama pemasok wajib diisi");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)
      throw new ValidationError("Jumlah hutang harus lebih dari 0");
    if (!due_date) throw new ValidationError("Tanggal jatuh tempo wajib diisi");

    const invoiceCode = generateInvoiceCode();
    const invoiceDate = invoice_date || new Date().toISOString().slice(0, 10);
    const status = computeStatus(amt, 0);

    const result = await payableModel.create({
      invoiceCode,
      supplierId: supplier_id || null,
      supplierName: supplier_name.trim(),
      purchaseId: purchase_id || null,
      amount: amt,
      paidAmount: 0,
      invoiceDate,
      dueDate: due_date,
      status,
      notes,
      recordedBy: recorded_by,
    });
    return payableModel.findById(result.insertId);
  },

  // Hutang boleh dihapus HANYA kalau belum pernah ada pembayaran tercatat
  // (paid_amount = 0) dan bukan hasil auto-generate dari pembelian kredit
  // (purchase_id kosong) — alasan sama seperti receivableService.remove():
  // payable_payments ikut CASCADE terhapus, entri jurnal (Dr Utang, Cr Kas)
  // yang sudah diposting tidak ikut terhapus/dibatalkan, dan hutang dari
  // pembelian kredit sudah tercatat di jurnal pembelian sejak awal.
  async remove(id) {
    const existing = await payableModel.findById(id);
    if (!existing) throw new NotFoundError("Hutang tidak ditemukan");
    if (parseFloat(existing.paid_amount) > 0)
      throw new ValidationError(
        "Hutang yang sudah ada pembayaran tidak dapat dihapus, karena akan membuat saldo jurnal tidak sinkron. Hapus/koreksi pembayarannya dulu, atau gunakan jurnal manual untuk penyesuaian.",
      );
    if (existing.purchase_id)
      throw new ValidationError(
        "Hutang ini tertaut ke pembelian kredit dan sudah tercatat di jurnal pembelian — tidak dapat dihapus langsung. Batalkan/koreksi lewat pembelian terkait, atau gunakan jurnal manual.",
      );
    await payableModel.remove(id);
  },

  async recordPayment(id, payload, user) {
    // Cek cepat di luar transaksi hanya untuk pesan error yang jelas kalau
    // ID-nya memang tidak ada. Validasi jumlah pembayaran vs sisa hutang
    // yang sebenarnya (race-safe) tetap di dalam payableModel.addPayment(),
    // setelah baris hutang dikunci dengan SELECT ... FOR UPDATE — mirror
    // dari receivableService.recordPayment(), lihat catatan di sana.
    const existing = await payableModel.findById(id);
    if (!existing) throw new NotFoundError("Hutang tidak ditemukan");

    const paymentDate =
      payload.payment_date || new Date().toISOString().slice(0, 10);
    const amt = parseFloat(payload.amount);
    if (!amt || amt <= 0)
      throw new ValidationError("Jumlah pembayaran harus lebih dari 0");

    // Sumber Dana pembayaran hutang (baru) — mirror persis pola "Sumber
    // Dana" di purchaseService.recordPurchase(): 'laci' (sesi kas kasir
    // yang sedang login/terbuka) atau 'kantor' (Kas besar / Bank toko,
    // TIDAK tertaut ke laci kasir manapun; kalau 'kantor', pilih akunnya
    // lewat target_account: 'kas' atau 'bank').
    //
    // Sebelumnya field "Metode" (cash/debit/qris/transfer) bebas dipilih
    // TANPA validasi saldo sama sekali — hutang bisa "dibayar" berapa pun
    // walau saldo Kas Laci/Kas Kantor/Bank sebenarnya tidak cukup. Sekarang
    // ditolak dengan pesan jelas ("saldo tidak cukup") sebelum pembayaran
    // dicatat, supaya saldo tidak bisa minus gara-gara pencatatan
    // pembayaran hutang.
    const paymentSource =
      payload.payment_source === "kantor" ? "kantor" : "laci";

    let paymentMethod;
    let shiftId = null;

    if (paymentSource === "laci") {
      const activeShift = await cashRegisterService.getActiveShift(user);
      if (!activeShift) {
        throw new ValidationError(
          'Tidak ada sesi kas (laci) yang sedang terbuka untuk Anda. Buka sesi kas dulu, atau pilih sumber dana "Kas/Bank Kantor".',
        );
      }
      if (Number(activeShift.expected_balance) < amt) {
        throw new ValidationError(
          `Saldo Kas Laci tidak cukup untuk pembayaran ini. Saldo laci saat ini Rp ${formatRupiah(activeShift.expected_balance)}, dibutuhkan Rp ${formatRupiah(amt)}.`,
        );
      }
      paymentMethod = "cash";
      shiftId = activeShift.id;
    } else {
      const targetAccount = payload.target_account === "bank" ? "bank" : "kas";
      const accountCode =
        targetAccount === "bank"
          ? journalService.ACC.BANK
          : journalService.ACC.KAS;
      const currentBalance = await journalService.getCurrentBalance(
        accountCode,
        paymentDate,
      );
      if (currentBalance < amt) {
        const label = targetAccount === "bank" ? "Bank" : "Kas Kantor";
        throw new ValidationError(
          `Saldo ${label} tidak cukup untuk pembayaran ini. Saldo saat ini Rp ${formatRupiah(currentBalance)}, dibutuhkan Rp ${formatRupiah(amt)}.`,
        );
      }
      // payment_method disimpan 'cash' untuk akun Kas Kantor (sama-sama
      // fisik/tunai seperti laci, cuma tidak tertaut ke sesi kasir manapun)
      // dan 'transfer' untuk akun Bank — dua nilai ini sudah dikenali
      // journalService.postPayablePaymentJournal() untuk memilih akun
      // lawan Kas (1100) vs Bank (1150) yang benar.
      paymentMethod = targetAccount === "bank" ? "transfer" : "cash";
      // shiftId TETAP null di sini — pembayaran dari Kas/Bank Kantor
      // sengaja tidak ditautkan ke laci kasir manapun (sama seperti
      // pembelian tunai sumber "kantor" di purchaseService).
    }

    // Jurnal (Dr Utang Usaha, Cr Kas/Bank) sudah diposting di dalam
    // payableModel.addPayment, dalam DB transaction yang sama dengan lock
    // baris, insert pembayaran & update paid_amount/status — lihat catatan
    // desain di journalService.js. Kalau jurnal gagal atau validasi sisa
    // gagal, semuanya ikut rollback.
    await payableModel.addPayment(id, {
      amount: amt,
      paymentDate,
      paymentMethod,
      notes: payload.notes,
      recordedBy: payload.recorded_by,
      shiftId,
    });

    return payableModel.findById(id);
  },

  // ─── Laporan ─────────────────────────────────────────────────────────────
  unpaidInvoices() {
    return payableModel
      .findAll({ status: null })
      .then((rows) => rows.filter((r) => r.status !== "lunas"));
  },
  unpaidBySupplier() {
    return payableModel.unpaidGroupedBySupplier();
  },
  aging() {
    return payableModel.agingReport();
  },
  history({ start_date, end_date, supplier_id }) {
    return payableModel.history({
      startDate: start_date,
      endDate: end_date,
      supplierId: supplier_id,
    });
  },
  summary() {
    return payableModel.summary();
  },
};

module.exports = payableService;
