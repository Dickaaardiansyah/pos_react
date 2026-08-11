// models/payableModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — akses data untuk Hutang (tagihan dari pemasok) & histori
// pembayarannya. Mirror dari receivableModel.js tapi arahnya kebalik: kita
// yang berhutang ke supplier.
// ─────────────────────────────────────────────────────────────────────────────
const {
  query,
  queryOne,
  insert,
  execute,
  transaction,
  safeInt,
} = require("../config/database");
const journalService = require("../services/journalService");
const journalModel = require("./journalModel");
const {
  ValidationError,
  NotFoundError,
} = require("../services/productService");

function computeStatus(amount, paidAmount) {
  if (paidAmount <= 0) return "belum_lunas";
  if (paidAmount >= amount) return "lunas";
  return "sebagian";
}

const payableModel = {
  // Insert hutang + posting jurnal (kalau perlu) terjadi dalam SATU DB
  // transaction — kalau jurnal gagal, insert hutang ikut rollback (mirror
  // pola capitalModel.create() / payableModel.addPayment()).
  //
  // Jurnal HANYA diposting kalau `purchaseId` kosong (hutang manual murni).
  // Hutang yang berasal dari modul Pembelian (ada purchaseId) sudah dapat
  // jurnalnya dari postPurchaseJournal() saat pembelian dibuat — posting
  // lagi di sini akan dobel-hitung.
  async create({
    invoiceCode,
    supplierId,
    supplierName,
    purchaseId,
    amount,
    paidAmount,
    invoiceDate,
    dueDate,
    status,
    notes,
    recordedBy,
  }) {
    return transaction(async (conn) => {
      const [result] = await conn.execute(
        `INSERT INTO payables
           (invoice_code, supplier_id, supplier_name, purchase_id, amount, paid_amount,
            invoice_date, due_date, status, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceCode,
          supplierId || null,
          supplierName,
          purchaseId || null,
          amount,
          paidAmount || 0,
          invoiceDate,
          dueDate,
          status,
          notes || "",
          recordedBy || "Admin",
        ],
      );

      if (!purchaseId) {
        await journalService.postPayableCreationJournal(
          {
            id: result.insertId,
            invoice_code: invoiceCode,
            supplier_name: supplierName,
            amount,
            invoice_date: invoiceDate,
            recorded_by: recordedBy,
          },
          conn,
        );
      }

      return result;
    });
  },

  findAll({ status, supplierId, search, overdueOnly, limit, offset }) {
    let where = "WHERE 1=1";
    const params = [];
    if (status) {
      where += " AND p.status = ?";
      params.push(status);
    }
    if (supplierId) {
      where += " AND p.supplier_id = ?";
      params.push(supplierId);
    }
    if (search) {
      where += " AND (p.invoice_code LIKE ? OR p.supplier_name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (overdueOnly) {
      where += " AND p.status != 'lunas' AND p.due_date < CURDATE()";
    }

    const listSql = `SELECT p.* FROM payables p ${where} ORDER BY p.due_date ASC, p.created_at DESC`;
    if (!limit) return query(listSql, params);

    return Promise.all([
      query(`SELECT COUNT(*) AS total FROM payables p ${where}`, params).then(
        (r) => r[0]?.total || 0,
      ),
      query(
        `${listSql} LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([total, rows]) => ({ total, rows }));
  },

  findById(id) {
    return queryOne("SELECT * FROM payables WHERE id = ?", [id]);
  },

  findByInvoiceCode(code) {
    return queryOne("SELECT * FROM payables WHERE invoice_code = ?", [code]);
  },

  updatePaidAmount(id, paidAmount, status) {
    return execute(
      "UPDATE payables SET paid_amount = ?, status = ? WHERE id = ?",
      [paidAmount, status, id],
    );
  },

  // Hapus hutang manual + jurnal pencatatannya (reference_type=
  // 'payable_creation') dalam SATU DB transaction — mirror pola
  // otherPayableModel.remove(). Service layer sudah menjamin ini hutang
  // manual (bukan hasil pembelian kredit) & belum ada pembayaran sebelum
  // manggil fungsi ini, jadi aman dihapus total tanpa jurnal koreksi.
  // Tanpa ini, jurnal (Dr Saldo Awal/Penyesuaian, Cr Utang Usaha) tetap
  // tertinggal di journal_entries dan terus mengganggu Neraca Saldo &
  // Ekuitas walau hutangnya sudah dihapus.
  remove(id) {
    return transaction(async (conn) => {
      await journalModel.deleteByReference("payable_creation", id, conn);
      const [result] = await conn.execute("DELETE FROM payables WHERE id = ?", [
        id,
      ]);
      return result;
    });
  },

  // ─── Pembayaran ──────────────────────────────────────────────────────────
  // FOR UPDATE — kunci baris hutang & hitung ulang sisa/paid_amount di
  // DALAM transaksi ini (bukan pakai nilai yang sudah dihitung service dari
  // findById() sebelum transaksi dibuka). Tanpa ini, dua pembayaran untuk
  // hutang yang sama yang diproses bersamaan bisa sama-sama membaca
  // paid_amount lama yang sama, sama-sama lolos validasi "tidak melebihi
  // sisa", lalu saling menimpa (lost update) — mirror dari
  // receivableModel.addPayment(), lihat catatan di sana.
  async addPayment(
    payableId,
    { amount, paymentDate, paymentMethod, notes, recordedBy },
  ) {
    return transaction(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT * FROM payables WHERE id = ? FOR UPDATE",
        [payableId],
      );
      const payable = rows[0];
      if (!payable) throw new NotFoundError("Hutang tidak ditemukan");

      const amt = parseFloat(amount);
      const sisa = parseFloat(payable.amount) - parseFloat(payable.paid_amount);
      if (!amt || amt <= 0)
        throw new ValidationError("Jumlah pembayaran harus lebih dari 0");
      if (amt > sisa + 0.01)
        throw new ValidationError(
          `Jumlah pembayaran melebihi sisa hutang (sisa: Rp ${sisa.toLocaleString("id-ID")})`,
        );

      const newPaidAmount = parseFloat(payable.paid_amount) + amt;
      const newStatus = computeStatus(
        parseFloat(payable.amount),
        newPaidAmount,
      );

      const [payResult] = await conn.execute(
        `INSERT INTO payable_payments (payable_id, amount, payment_date, payment_method, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          payableId,
          amt,
          paymentDate,
          paymentMethod || "cash",
          notes || "",
          recordedBy || "Admin",
        ],
      );
      await conn.execute(
        "UPDATE payables SET paid_amount = ?, status = ? WHERE id = ?",
        [newPaidAmount, newStatus, payableId],
      );

      await journalService.postPayablePaymentJournal(
        {
          amount: amt,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          recorded_by: recordedBy,
        },
        payable,
        conn,
      );

      return { paymentId: payResult.insertId, newPaidAmount, newStatus };
    });
  },

  findPayments(payableId) {
    return query(
      "SELECT * FROM payable_payments WHERE payable_id = ? ORDER BY payment_date DESC, created_at DESC",
      [payableId],
    );
  },

  // ─── Laporan: Faktur Belum Lunas per Pemasok ───────────────────────────
  unpaidGroupedBySupplier() {
    return query(
      `SELECT COALESCE(p.supplier_id, 0) AS supplier_id, p.supplier_name,
              COUNT(*) AS total_faktur,
              SUM(p.amount) AS total_tagihan,
              SUM(p.paid_amount) AS total_dibayar,
              SUM(p.amount - p.paid_amount) AS total_sisa,
              MIN(p.due_date) AS jatuh_tempo_terdekat
       FROM payables p
       WHERE p.status != 'lunas'
       GROUP BY p.supplier_id, p.supplier_name
       ORDER BY total_sisa DESC`,
    );
  },

  // ─── Laporan: Umur Hutang (Aging) ──────────────────────────────────────
  agingReport() {
    return query(
      `SELECT p.id, p.invoice_code, p.supplier_name, p.amount, p.paid_amount,
              (p.amount - p.paid_amount) AS sisa_tagihan, p.due_date,
              DATEDIFF(CURDATE(), p.due_date) AS hari_terlambat,
              CASE
                WHEN DATEDIFF(CURDATE(), p.due_date) <= 0 THEN 'belum_jatuh_tempo'
                WHEN DATEDIFF(CURDATE(), p.due_date) BETWEEN 1 AND 30 THEN '1-30'
                WHEN DATEDIFF(CURDATE(), p.due_date) BETWEEN 31 AND 60 THEN '31-60'
                WHEN DATEDIFF(CURDATE(), p.due_date) BETWEEN 61 AND 90 THEN '61-90'
                ELSE '90+'
              END AS bucket
       FROM payables p
       WHERE p.status != 'lunas'
       ORDER BY hari_terlambat DESC`,
    );
  },

  // ─── Laporan: Histori Hutang (pembayaran per pemasok) ──────────────────
  history({ startDate, endDate, supplierId }) {
    let where = "WHERE 1=1";
    const params = [];
    if (startDate) {
      where += " AND pp.payment_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND pp.payment_date <= ?";
      params.push(endDate);
    }
    if (supplierId) {
      where += " AND p.supplier_id = ?";
      params.push(supplierId);
    }
    return query(
      `SELECT pp.id, pp.payment_date, pp.amount, pp.payment_method, pp.notes,
              p.invoice_code, p.supplier_name, p.amount AS total_tagihan
       FROM payable_payments pp
       JOIN payables p ON pp.payable_id = p.id
       ${where}
       ORDER BY pp.payment_date DESC, pp.created_at DESC`,
      params,
    );
  },

  // ─── Ringkasan untuk monitoring/dashboard ───────────────────────────────
  summary() {
    return queryOne(
      `SELECT
         COUNT(*) AS total_faktur_belum_lunas,
         COALESCE(SUM(amount - paid_amount), 0) AS total_hutang,
         COALESCE(SUM(CASE WHEN due_date < CURDATE() THEN amount - paid_amount ELSE 0 END), 0) AS total_jatuh_tempo,
         COUNT(CASE WHEN due_date < CURDATE() THEN 1 END) AS jumlah_jatuh_tempo
       FROM payables WHERE status != 'lunas'`,
    );
  },
};

module.exports = payableModel;
