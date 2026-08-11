// models/otherPayableModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — Hutang Non-Supplier: Pinjaman Bank & Utang Lainnya. Mirror
// pola payableModel.js, tapi header-nya beda (principal_amount vs
// outstanding_amount, bukan amount vs paid_amount) karena ada bunga yang
// tidak mengurangi pokok. Lihat design/desain-hutang-non-supplier.md.
// ─────────────────────────────────────────────────────────────────────────────
const { query, queryOne, transaction, safeInt } = require("../config/database");
const journalService = require("../services/journalService");
const journalModel = require("./journalModel");
const {
  ValidationError,
  NotFoundError,
} = require("../services/productService");

const otherPayableModel = {
  // Insert pinjaman + posting jurnal pencairan dalam SATU DB transaction —
  // kalau jurnal gagal (mis. akun sistem hilang), insert ikut rollback.
  async create({
    code,
    type,
    creditorName,
    principalAmount,
    interestRate,
    disbursementDate,
    dueDate,
    targetAccount,
    notes,
    recordedBy,
  }) {
    return transaction(async (conn) => {
      const [result] = await conn.execute(
        `INSERT INTO other_payables
           (code, type, creditor_name, principal_amount, outstanding_amount,
            interest_rate, disbursement_date, due_date, target_account,
            status, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?)`,
        [
          code,
          type,
          creditorName,
          principalAmount,
          principalAmount, // outstanding_amount = principal_amount saat baru dicairkan
          interestRate || null,
          disbursementDate,
          dueDate,
          targetAccount || "bank",
          notes || "",
          recordedBy || "Admin",
        ],
      );

      await journalService.postOtherPayableJournal(
        {
          id: result.insertId,
          code,
          type,
          creditor_name: creditorName,
          principal_amount: principalAmount,
          disbursement_date: disbursementDate,
          target_account: targetAccount || "bank",
          recorded_by: recordedBy,
        },
        conn,
      );

      return result;
    });
  },

  findAll({ status, type, search, limit, offset }) {
    let where = "WHERE 1=1";
    const params = [];
    if (status) {
      where += " AND status = ?";
      params.push(status);
    }
    if (type) {
      where += " AND type = ?";
      params.push(type);
    }
    if (search) {
      where += " AND (code LIKE ? OR creditor_name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const listSql = `SELECT * FROM other_payables ${where} ORDER BY due_date ASC, created_at DESC`;
    if (!limit) return query(listSql, params);

    return Promise.all([
      query(
        `SELECT COUNT(*) AS total FROM other_payables ${where}`,
        params,
      ).then((r) => r[0]?.total || 0),
      query(
        `${listSql} LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([total, rows]) => ({ total, rows }));
  },

  findById(id) {
    return queryOne("SELECT * FROM other_payables WHERE id = ?", [id]);
  },

  // Hapus pinjaman + jurnal pencairannya (reference_type='other_payable')
  // dalam SATU DB transaction — mirror pola create(). Tanpa ini, jurnal
  // pencairan tetap tertinggal di journal_entries dan terus muncul di
  // Neraca Saldo & Laporan Arus Kas walau pinjamannya sudah dihapus.
  // (Service layer sudah memastikan belum ada cicilan sebelum manggil ini,
  // jadi aman dihapus total tanpa jurnal koreksi.)
  remove(id) {
    return transaction(async (conn) => {
      await journalModel.deleteByReference("other_payable", id, conn);
      const [result] = await conn.execute(
        "DELETE FROM other_payables WHERE id = ?",
        [id],
      );
      return result;
    });
  },

  // ─── Pembayaran cicilan (pokok + bunga) ────────────────────────────────
  // FOR UPDATE — kunci baris pinjaman & hitung ulang outstanding_amount di
  // DALAM transaksi ini, mirror payableModel.addPayment().
  async addPayment(
    otherPayableId,
    {
      principalAmount,
      interestAmount,
      paymentDate,
      paymentMethod,
      notes,
      recordedBy,
    },
  ) {
    return transaction(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT * FROM other_payables WHERE id = ? FOR UPDATE",
        [otherPayableId],
      );
      const op = rows[0];
      if (!op) throw new NotFoundError("Pinjaman/utang tidak ditemukan");

      const principal = parseFloat(principalAmount) || 0;
      const interest = parseFloat(interestAmount) || 0;
      const outstanding = parseFloat(op.outstanding_amount);

      if (principal + interest <= 0)
        throw new ValidationError("Jumlah pembayaran harus lebih dari 0");
      if (principal > outstanding + 0.01)
        throw new ValidationError(
          `Porsi pokok melebihi sisa pokok pinjaman (sisa: Rp ${outstanding.toLocaleString("id-ID")})`,
        );

      const newOutstanding = Math.max(0, outstanding - principal);
      const newStatus = newOutstanding <= 0.01 ? "lunas" : "aktif";

      const [payResult] = await conn.execute(
        `INSERT INTO other_payable_payments
           (other_payable_id, payment_date, principal_amount, interest_amount, payment_method, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          otherPayableId,
          paymentDate,
          principal,
          interest,
          paymentMethod || "transfer",
          notes || "",
          recordedBy || "Admin",
        ],
      );
      await conn.execute(
        "UPDATE other_payables SET outstanding_amount = ?, status = ? WHERE id = ?",
        [newOutstanding, newStatus, otherPayableId],
      );

      await journalService.postOtherPayablePaymentJournal(
        {
          principal_amount: principal,
          interest_amount: interest,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          recorded_by: recordedBy,
        },
        op,
        conn,
      );

      return { paymentId: payResult.insertId, newOutstanding, newStatus };
    });
  },

  findPayments(otherPayableId) {
    return query(
      "SELECT * FROM other_payable_payments WHERE other_payable_id = ? ORDER BY payment_date DESC, created_at DESC",
      [otherPayableId],
    );
  },

  summary() {
    return queryOne(
      `SELECT
         COUNT(*) AS total_pinjaman_aktif,
         COALESCE(SUM(outstanding_amount), 0) AS total_sisa_pokok,
         COALESCE(SUM(CASE WHEN due_date < CURDATE() THEN outstanding_amount ELSE 0 END), 0) AS total_jatuh_tempo
       FROM other_payables WHERE status != 'lunas'`,
    );
  },
};

module.exports = otherPayableModel;
