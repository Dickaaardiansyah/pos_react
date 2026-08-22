// models/receivableModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — akses data untuk Piutang (tagihan ke pelanggan) & histori
// pembayarannya. Status ('belum_lunas' | 'sebagian' | 'lunas') selalu
// dihitung ulang di service dari amount vs paid_amount, model hanya
// menyimpan nilai final yang dikirim service.
// ─────────────────────────────────────────────────────────────────────────────
const {
  query,
  queryOne,
  execute,
  transaction,
  safeInt,
} = require("../config/database");
const journalService = require("../services/journalService");
const {
  ValidationError,
  NotFoundError,
} = require("../services/productService");
const { lockOpenShift } = require("./shiftLockHelper");

function computeStatus(amount, paidAmount) {
  if (paidAmount <= 0) return "belum_lunas";
  if (paidAmount >= amount) return "lunas";
  return "sebagian";
}

const receivableModel = {
  create({
    invoiceCode,
    customerId,
    customerName,
    transactionId,
    amount,
    paidAmount,
    paymentMethod,
    invoiceDate,
    dueDate,
    status,
    notes,
    recordedBy,
  }) {
    return transaction(async (conn) => {
      const [result] = await conn.execute(
        `INSERT INTO receivables
           (invoice_code, customer_id, customer_name, transaction_id, amount, paid_amount,
            invoice_date, due_date, status, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceCode,
          customerId || null,
          customerName,
          transactionId || null,
          amount,
          paidAmount || 0,
          invoiceDate,
          dueDate,
          status,
          notes || "",
          recordedBy || "Admin",
        ],
      );

      const receivableId = result.insertId;

      if (!transactionId) {
        const receivableForJournal = {
          id: receivableId,
          invoice_code: invoiceCode,
          customer_name: customerName,
          amount,
          invoice_date: invoiceDate,
          recorded_by: recordedBy,
        };

        await journalService.postReceivableCreationJournal(
          receivableForJournal,
          conn,
        );

        const paid = parseFloat(paidAmount) || 0;
        if (paid > 0) {
          await conn.execute(
            `INSERT INTO receivable_payments (receivable_id, amount, payment_date, payment_method, notes, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              receivableId,
              paid,
              invoiceDate,
              paymentMethod || "cash",
              "Pembayaran awal saat pencatatan piutang manual",
              recordedBy || "Admin",
            ],
          );
          await journalService.postReceivablePaymentJournal(
            {
              amount: paid,
              payment_date: invoiceDate,
              payment_method: paymentMethod,
              recorded_by: recordedBy,
            },
            receivableForJournal,
            conn,
          );
        }
      }

      return result;
    });
  },

  findAll({ status, customerId, search, overdueOnly, limit, offset }) {
    let where = "WHERE 1=1";
    const params = [];
    if (status) {
      where += " AND r.status = ?";
      params.push(status);
    }
    if (customerId) {
      where += " AND r.customer_id = ?";
      params.push(customerId);
    }
    if (search) {
      where += " AND (r.invoice_code LIKE ? OR r.customer_name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (overdueOnly) {
      where +=
        " AND r.status NOT IN ('lunas','dibatalkan') AND r.due_date < CURDATE()";
    }

    const listSql = `SELECT r.* FROM receivables r ${where} ORDER BY r.due_date ASC, r.created_at DESC`;
    if (!limit) return query(listSql, params);

    return Promise.all([
      query(
        `SELECT COUNT(*) AS total FROM receivables r ${where}`,
        params,
      ).then((r) => r[0]?.total || 0),
      query(
        `${listSql} LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([total, rows]) => ({ total, rows }));
  },

  findById(id) {
    return queryOne("SELECT * FROM receivables WHERE id = ?", [id]);
  },

  findByInvoiceCode(code) {
    return queryOne("SELECT * FROM receivables WHERE invoice_code = ?", [code]);
  },

  updatePaidAmount(id, paidAmount, status) {
    return execute(
      "UPDATE receivables SET paid_amount = ?, status = ? WHERE id = ?",
      [paidAmount, status, id],
    );
  },

  remove(id) {
    return execute("DELETE FROM receivables WHERE id = ?", [id]);
  },

  // ─── Pembayaran ──────────────────────────────────────────────────────────
  // FOR UPDATE — kunci baris piutang & hitung ulang sisa/paid_amount di
  // DALAM transaksi ini (bukan pakai nilai yang sudah dihitung service dari
  // findById() sebelum transaksi dibuka). Tanpa ini, dua pembayaran untuk
  // piutang yang sama yang diproses bersamaan bisa sama-sama membaca
  // paid_amount lama yang sama, sama-sama lolos validasi "tidak melebihi
  // sisa", lalu saling menimpa (lost update) — pembayaran salah satu bisa
  // "hilang", atau piutang jadi overpaid melebihi total tagihan.
  // Validasi jumlah (amt > sisa) juga diulang di sini setelah lock,
  // supaya keputusannya berdasarkan data terkini, bukan data basi yang
  // dibaca sebelum menunggu giliran lock.
  async addPayment(
    receivableId,
    { amount, paymentDate, paymentMethod, notes, recordedBy, shiftId },
  ) {
    return transaction(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT * FROM receivables WHERE id = ? FOR UPDATE",
        [receivableId],
      );
      const receivable = rows[0];
      if (!receivable) throw new NotFoundError("Piutang tidak ditemukan");

      const amt = parseFloat(amount);
      const sisa =
        parseFloat(receivable.amount) - parseFloat(receivable.paid_amount);
      if (!amt || amt <= 0)
        throw new ValidationError("Jumlah pembayaran harus lebih dari 0");
      if (amt > sisa + 0.01)
        throw new ValidationError(
          `Jumlah pembayaran melebihi sisa piutang (sisa: Rp ${sisa.toLocaleString("id-ID")})`,
        );

      const newPaidAmount = parseFloat(receivable.paid_amount) + amt;
      const newStatus = computeStatus(
        parseFloat(receivable.amount),
        newPaidAmount,
      );

      const resolvedShiftId =
        (paymentMethod || "cash") === "cash" ? shiftId || null : null;

      const [payResult] = await conn.execute(
        `INSERT INTO receivable_payments (receivable_id, amount, payment_date, payment_method, shift_id, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          receivableId,
          amt,
          paymentDate,
          paymentMethod || "cash",
          resolvedShiftId,
          notes || "",
          recordedBy || "Admin",
        ],
      );
      await conn.execute(
        "UPDATE receivables SET paid_amount = ?, status = ? WHERE id = ?",
        [newPaidAmount, newStatus, receivableId],
      );

      await journalService.postReceivablePaymentJournal(
        {
          amount: amt,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          recorded_by: recordedBy,
        },
        receivable,
        conn,
      );

      return { paymentId: payResult.insertId, newPaidAmount, newStatus };
    });
  },

  findPayments(receivableId) {
    return query(
      "SELECT * FROM receivable_payments WHERE receivable_id = ? ORDER BY payment_date DESC, created_at DESC",
      [receivableId],
    );
  },

  // ─── Laporan: Faktur Belum Lunas per Pelanggan ─────────────────────────
  unpaidGroupedByCustomer() {
    return query(
      `SELECT COALESCE(r.customer_id, 0) AS customer_id, r.customer_name,
              COUNT(*) AS total_faktur,
              SUM(r.amount) AS total_tagihan,
              SUM(r.paid_amount) AS total_dibayar,
              SUM(r.amount - r.paid_amount) AS total_sisa,
              MIN(r.due_date) AS jatuh_tempo_terdekat
       FROM receivables r
       WHERE r.status NOT IN ('lunas','dibatalkan')
       GROUP BY r.customer_id, r.customer_name
       ORDER BY total_sisa DESC`,
    );
  },

  // ─── Laporan: Umur Piutang (Aging) ──────────────────────────────────────
  agingReport() {
    return query(
      `SELECT r.id, r.invoice_code, r.customer_name, r.amount, r.paid_amount,
              (r.amount - r.paid_amount) AS sisa_tagihan, r.due_date,
              DATEDIFF(CURDATE(), r.due_date) AS hari_terlambat,
              CASE
                WHEN DATEDIFF(CURDATE(), r.due_date) <= 0 THEN 'belum_jatuh_tempo'
                WHEN DATEDIFF(CURDATE(), r.due_date) BETWEEN 1 AND 30 THEN '1-30'
                WHEN DATEDIFF(CURDATE(), r.due_date) BETWEEN 31 AND 60 THEN '31-60'
                WHEN DATEDIFF(CURDATE(), r.due_date) BETWEEN 61 AND 90 THEN '61-90'
                ELSE '90+'
              END AS bucket
       FROM receivables r
       WHERE r.status NOT IN ('lunas','dibatalkan')
       ORDER BY hari_terlambat DESC`,
    );
  },

  // ─── Laporan: Histori Piutang (transaksi + pembayaran per pelanggan) ───
  history({ startDate, endDate, customerId }) {
    let where = "WHERE 1=1";
    const params = [];
    if (startDate) {
      where += " AND rp.payment_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND rp.payment_date <= ?";
      params.push(endDate);
    }
    if (customerId) {
      where += " AND r.customer_id = ?";
      params.push(customerId);
    }
    return query(
      `SELECT rp.id, rp.payment_date, rp.amount, rp.payment_method, rp.notes,
              r.invoice_code, r.customer_name, r.amount AS total_tagihan
       FROM receivable_payments rp
       JOIN receivables r ON rp.receivable_id = r.id
       ${where}
       ORDER BY rp.payment_date DESC, rp.created_at DESC`,
      params,
    );
  },

  // ─── Ringkasan untuk monitoring/dashboard ───────────────────────────────
  summary() {
    return queryOne(
      `SELECT
         COUNT(*) AS total_faktur_belum_lunas,
         COALESCE(SUM(amount - paid_amount), 0) AS total_piutang,
         COALESCE(SUM(CASE WHEN due_date < CURDATE() THEN amount - paid_amount ELSE 0 END), 0) AS total_jatuh_tempo,
         COUNT(CASE WHEN due_date < CURDATE() THEN 1 END) AS jumlah_jatuh_tempo
       FROM receivables WHERE status NOT IN ('lunas','dibatalkan')`,
    );
  },
};

module.exports = receivableModel;
