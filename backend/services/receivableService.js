// services/receivableService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — aturan bisnis Piutang: validasi input, kode faktur otomatis,
// perhitungan status (belum_lunas/sebagian/lunas) dari amount vs paid_amount,
// serta pencatatan pembayaran yang tidak boleh melebihi sisa tagihan.
// ─────────────────────────────────────────────────────────────────────────────
const receivableModel = require("../models/receivableModel");
const transactionModel = require("../models/transactionModel");
const { ValidationError, NotFoundError } = require("./productService");

function computeStatus(amount, paidAmount) {
  if (paidAmount <= 0) return "belum_lunas";
  if (paidAmount >= amount) return "lunas";
  return "sebagian";
}

function generateInvoiceCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PIU-${y}${m}${d}-${rand}`;
}

const receivableService = {
  list({ status, customer_id, search, overdue_only, page, limit }) {
    const params = {
      status,
      customerId: customer_id,
      search,
      overdueOnly: overdue_only === "true",
    };
    if (!limit) return receivableModel.findAll(params);
    const parsedLimit = parseInt(limit) || 20;
    const parsedPage = parseInt(page) || 1;
    return receivableModel.findAll({
      ...params,
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit,
    });
  },

  async getById(id) {
    const receivable = await receivableModel.findById(id);
    if (!receivable) throw new NotFoundError("Piutang tidak ditemukan");
    const payments = await receivableModel.findPayments(id);

    // Kalau faktur ini berasal dari transaksi Open Bill di Kasir, sertakan
    // juga daftar barang (nama produk, qty, harga) supaya bisa dicek
    // kesesuaiannya dengan yang sebenarnya diambil pelanggan.
    let items = [];
    if (receivable.transaction_id) {
      items = await transactionModel.findItemsByTransactionId(
        receivable.transaction_id,
      );
    }

    return { ...receivable, payments, items };
  },

  async create(payload) {
    const {
      customer_name,
      customer_id,
      amount,
      due_date,
      invoice_date,
      paid_amount,
      payment_method,
      notes,
      recorded_by,
      transaction_id,
    } = payload;

    if (!customer_name || !customer_name.trim())
      throw new ValidationError("Nama pelanggan wajib diisi");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)
      throw new ValidationError("Jumlah piutang harus lebih dari 0");
    if (!due_date) throw new ValidationError("Tanggal jatuh tempo wajib diisi");

    const paid = parseFloat(paid_amount) || 0;
    if (paid > amt)
      throw new ValidationError(
        "Jumlah dibayar tidak boleh melebihi jumlah piutang",
      );

    const invoiceCode = generateInvoiceCode();
    const invoiceDate = invoice_date || new Date().toISOString().slice(0, 10);
    const status = computeStatus(amt, paid);

    const result = await receivableModel.create({
      invoiceCode,
      customerId: customer_id || null,
      customerName: customer_name.trim(),
      transactionId: transaction_id || null,
      amount: amt,
      paidAmount: paid,
      paymentMethod: payment_method,
      invoiceDate,
      dueDate: due_date,
      status,
      notes,
      recordedBy: recorded_by,
    });
    return receivableModel.findById(result.insertId);
  },

  // Piutang boleh dihapus HANYA kalau BUKAN hasil auto-generate dari
  // transaksi Open Bill (transaction_id kosong). Alasannya:
  //   1) receivable_payments di-CASCADE DELETE ikut hilang kalau induknya
  //      dihapus — riwayat pembayaran lenyap.
  //   2) Kalau piutang ini berasal dari transaksi Open Bill, jurnal
  //      penjualannya (Dr Piutang) sudah tercatat sejak transaksi dibuat —
  //      menghapus piutangnya di sini tidak membatalkan jurnal itu, jadi
  //      piutang yang masih outstanding bisa "hilang" dari pelacakan padahal
  //      GL Piutang tetap mencatatnya.
  //   3) FIX (revisi dosen #16): piutang MANUAL (transaction_id kosong)
  //      sekarang SELALU langsung diposting jurnal pengakuan awal saat
  //      dibuat (Dr Piutang Usaha, Cr Saldo Awal/Penyesuaian — lihat
  //      receivableModel.create()), terlepas dari paid_amount-nya 0 atau
  //      tidak. Jadi syarat lama "boleh dihapus asal paid_amount masih 0"
  //      TIDAK BERLAKU LAGI — menghapus baris piutang manual TANPA
  //      membatalkan jurnal pengakuan awalnya justru akan membuat GL
  //      Piutang Usaha tidak sinkron dari subledger, dari arah sebaliknya
  //      (GL masih mencatat piutang yang subledger-nya sudah hilang).
  // Kalau piutang sudah tidak relevan/salah input, gunakan jurnal manual
  // (jurnal koreksi/pembalik) untuk membatalkannya, bukan menghapus baris
  // subledger-nya.
  async remove(id) {
    const existing = await receivableModel.findById(id);
    if (!existing) throw new NotFoundError("Piutang tidak ditemukan");
    if (existing.transaction_id) {
      throw new ValidationError(
        "Piutang ini tertaut ke transaksi Open Bill dan sudah tercatat di jurnal penjualan — tidak dapat dihapus langsung. Batalkan/koreksi lewat transaksi terkait, atau gunakan jurnal manual.",
      );
    }
    throw new ValidationError(
      "Piutang manual sudah tercatat ke jurnal akuntansi sejak dibuat, sehingga tidak dapat dihapus langsung — menghapusnya akan membuat GL Piutang Usaha tidak sinkron dari subledger. Gunakan jurnal manual untuk membatalkan/mengoreksinya.",
    );
  },

  async recordPayment(id, payload) {
    // Cek cepat di luar transaksi hanya untuk pesan error yang jelas kalau
    // ID-nya memang tidak ada. Validasi jumlah pembayaran yang sebenarnya
    // (amt vs sisa) TIDAK dilakukan di sini lagi — itu dipindah ke dalam
    // receivableModel.addPayment(), setelah baris piutang dikunci dengan
    // SELECT ... FOR UPDATE, supaya keputusannya berdasarkan paid_amount
    // terkini, bukan data yang mungkin sudah basi kalau ada pembayaran lain
    // yang diproses bersamaan (concurrent).
    const existing = await receivableModel.findById(id);
    if (!existing) throw new NotFoundError("Piutang tidak ditemukan");

    const paymentDate =
      payload.payment_date || new Date().toISOString().slice(0, 10);

    // Jurnal (Dr Kas/Bank, Cr Piutang Usaha) sudah diposting di dalam
    // receivableModel.addPayment, dalam DB transaction yang sama dengan
    // lock baris, insert pembayaran & update paid_amount/status. Kalau
    // jurnal gagal atau validasi sisa gagal, semuanya ikut rollback —
    // lihat catatan desain di journalService.js.
    await receivableModel.addPayment(id, {
      amount: payload.amount,
      paymentDate,
      paymentMethod: payload.payment_method,
      notes: payload.notes,
      recordedBy: payload.recorded_by,
    });

    return receivableModel.findById(id);
  },

  // ─── Laporan ─────────────────────────────────────────────────────────────
  // customerId opsional — dipakai untuk drill-down "Menu Open Bill: pilih
  // pelanggan → daftar tagihan pelanggan tsb".
  unpaidInvoices(customerId) {
    return receivableModel
      .findAll({ status: null, customerId: customerId || null })
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : rows?.rows || [];
        return list.filter(
          (r) => r.status !== "lunas" && r.status !== "dibatalkan",
        );
      });
  },
  unpaidByCustomer() {
    return receivableModel.unpaidGroupedByCustomer();
  },
  aging() {
    return receivableModel.agingReport();
  },
  history({ start_date, end_date, customer_id }) {
    return receivableModel.history({
      startDate: start_date,
      endDate: end_date,
      customerId: customer_id,
    });
  },
  summary() {
    return receivableModel.summary();
  },
};

module.exports = receivableService;
