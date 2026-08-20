// models/cashRegisterModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — modul Kas Kecil: sesi kas (cash_shifts) dan pergerakan kas
// insidental (cash_movements). Query mentah saja; aturan bisnis (validasi,
// perhitungan selisih, dsb.) hidup di services/cashRegisterService.js.
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
const {
  ValidationError,
  NotFoundError,
} = require("../services/productService");

const cashRegisterModel = {
  // ─── Sesi kas (shift) ───────────────────────────────────────────────────
  // FIX (revisi: sesi kas per kasir, bukan global): dulu SATU sesi 'open'
  // dianggap milik seluruh toko (LIMIT 1 tanpa filter user) — kasir mana pun
  // yang login akan mendapat sesi aktif yang sama, termasuk sesi yang dibuka
  // kasir lain. Sekarang tiap kasir membuka & memakai sesinya SENDIRI: query
  // ini mengambil sesi 'open' milik userId tsb secara spesifik, bukan sesi
  // 'open' siapa pun di toko.
  //
  // opened_by_user_id IS NULL tetap ikut dicakup (bukan cuma exact match)
  // untuk kompatibilitas mundur dengan sesi lama (dibuka sebelum migration
  // cash_shift_ownership.sql) yang memang tidak punya pemilik tercatat —
  // konsisten dengan pengecualian yang sama di
  // cashRegisterService.assertOwnsShift(). Kalau userId tidak diberikan
  // (null/undefined), query ini otomatis jadi "sesi open tanpa pemilik
  // terlama" saja — dipakai sebagai fallback aman, bukan lagi "sesi open
  // milik siapa saja" seperti versi lama.
  findActiveShift(userId) {
    return queryOne(
      `SELECT * FROM cash_shifts
       WHERE status = 'open' AND (opened_by_user_id = ? OR opened_by_user_id IS NULL)
       ORDER BY id DESC LIMIT 1`,
      [userId ?? null],
    );
  },

  // Dipakai KHUSUS saat kasir membuka sesi baru, untuk mengecek apakah
  // KASIR INI SENDIRI sudah punya sesi terbuka. Sengaja TIDAK ikut mencakup
  // sesi lama ber-owner NULL (beda dari findActiveShift di atas) — supaya
  // satu sesi legacy yang belum ditutup tidak memblokir SEMUA kasir lain
  // membuka sesi mereka masing-masing; hanya pemilik aslinya (kalau
  // tercatat) yang diblokir dari membuka sesi kedua.
  findOwnOpenShift(userId) {
    return queryOne(
      "SELECT * FROM cash_shifts WHERE status = 'open' AND opened_by_user_id = ? LIMIT 1",
      [userId],
    );
  },

  findShiftById(id) {
    return queryOne("SELECT * FROM cash_shifts WHERE id = ?", [id]);
  },

  // FIX (revisi dosen #13): findOwnOpenShift() (dipanggil di
  // cashRegisterService.openShift() sebelum ini) dan INSERT di bawah TIDAK
  // atomic — dua request "buka kas" nyaris bersamaan dari kasir yang sama
  // bisa sama-sama lolos pengecekan itu lalu sama-sama sampai ke INSERT ini.
  // Constraint sebenarnya sekarang ditegakkan DB lewat unique index
  // uq_cash_shifts_single_open_per_cashier (generated column open_guard,
  // lihat migration database/cash_shift_single_open_guard.sql) — request
  // KEDUA yang mencoba INSERT sesi 'open' kedua untuk kasir yang sama akan
  // ditolak DB dengan ER_DUP_ENTRY. Di sini errornya ditangkap dan
  // diterjemahkan jadi pesan yang sama seperti pengecekan awal, supaya
  // perilakunya konsisten dari sisi pemanggil terlepas dari mana yang
  // sebenarnya menangkap race-nya (app-level check atau DB constraint).
  async createShift({
    shiftCode,
    openingBalance,
    openingNotes,
    openedBy,
    openedByUserId,
    occurredAt,
  }) {
    try {
      return await insert(
        `INSERT INTO cash_shifts
           (shift_code, opening_balance, opening_notes, opened_by, opened_by_user_id, opened_at, status)
         VALUES (?, ?, ?, ?, ?, ?, 'open')`,
        [
          shiftCode,
          openingBalance,
          openingNotes || "",
          openedBy || "Admin",
          openedByUserId ?? null,
          occurredAt,
        ],
      );
    } catch (err) {
      if (
        err.code === "ER_DUP_ENTRY" &&
        err.message?.includes("uq_cash_shifts_single_open_per_cashier")
      ) {
        throw new ValidationError(
          "Anda masih memiliki sesi kas yang terbuka. Tutup kas Anda terlebih dahulu sebelum membuka sesi baru",
        );
      }
      throw err;
    }
  },

  // Tutup sesi kas + posting jurnal penyesuaian selisih (jika ada) dalam
  // satu DB transaction — kalau jurnal gagal, penutupan sesi ikut rollback
  // (tidak ada lagi sesi "tertutup" tanpa jurnal selisihnya tercatat).
  //
  // FIX (revisi dosen #13): sebelumnya pengecekan "status masih open?"
  // HANYA dilakukan di cashRegisterService.closeShift(), SEBELUM transaction
  // ini dimulai (baca-lalu-tulis, tidak atomic) — kalau dua request tutup
  // kas untuk shift yang sama datang nyaris bersamaan, keduanya bisa
  // sama-sama lolos pengecekan "status === 'open'" (baca dari baris yang
  // belum dikunci siapa pun), lalu keduanya menjalankan UPDATE + posting
  // jurnal penutupan — GL jadi mencatat jurnal selisih DUA KALI untuk satu
  // sesi yang sama. Sekarang: SELECT ... FOR UPDATE mengunci baris shift ini
  // DI DALAM transaction sebelum apa pun ditulis, lalu status di-cek ULANG
  // dari data yang sudah terkunci (bukan data yang mungkin sudah basi saat
  // request ini menunggu giliran) — mirror pola yang sama seperti
  // receivableModel.addPayment()/payableModel.addPayment(). Request kedua
  // yang menyusul akan menunggu sampai transaction pertama commit, lalu
  // melihat status sudah 'closed' dan gagal dengan error yang jelas alih-
  // alih ikut memposting jurnal kedua.
  closeShift(
    id,
    {
      closingBalanceSystem,
      closingBalancePhysical,
      difference,
      totalCashSales,
      totalCashIn,
      totalCashOut,
      // FIX (revisi dosen #17): snapshot 5 kategori transaksi kas yang
      // sebelumnya diabaikan — lihat cashRegisterService.buildShiftSummary().
      totalCashReceivable,
      totalCashPayable,
      totalCashPurchase,
      totalCashCapitalIn,
      totalCashCapitalOut,
      totalCashExpense,
      closingNotes,
      closedBy,
      closedByUserId,
      occurredAt,
    },
  ) {
    return transaction(async (conn) => {
      const [lockRows] = await conn.execute(
        "SELECT * FROM cash_shifts WHERE id = ? FOR UPDATE",
        [id],
      );
      const current = lockRows[0];
      if (!current) throw new NotFoundError("Sesi kas tidak ditemukan");
      if (current.status !== "open") {
        throw new ValidationError("Sesi kas ini sudah ditutup sebelumnya");
      }

      await conn.execute(
        `UPDATE cash_shifts SET
           closing_balance_system = ?, closing_balance_physical = ?, difference = ?,
           total_cash_sales = ?, total_cash_in = ?, total_cash_out = ?,
           total_cash_receivable = ?, total_cash_payable = ?, total_cash_purchase = ?,
           total_cash_capital_in = ?, total_cash_capital_out = ?, total_cash_expense = ?,
           closing_notes = ?, closed_by = ?, closed_by_user_id = ?, closed_at = ?, status = 'closed'
         WHERE id = ?`,
        [
          closingBalanceSystem,
          closingBalancePhysical,
          difference,
          totalCashSales,
          totalCashIn,
          totalCashOut,
          totalCashReceivable,
          totalCashPayable,
          totalCashPurchase,
          totalCashCapitalIn,
          totalCashCapitalOut,
          totalCashExpense,
          closingNotes || "",
          closedBy || "Admin",
          closedByUserId ?? null,
          occurredAt,
          id,
        ],
      );

      const [rows] = await conn.execute(
        "SELECT * FROM cash_shifts WHERE id = ?",
        [id],
      );
      const closed = rows[0];
      await journalService.postCashShiftCloseJournal(closed, conn);
      return closed;
    });
  },

  findShiftHistory({ startDate, endDate, limit = 20, offset = 0 } = {}) {
    const params = [];
    let where = "WHERE status = 'closed'";
    if (startDate) {
      where += " AND DATE(opened_at) >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND DATE(opened_at) <= ?";
      params.push(endDate);
    }

    return Promise.all([
      queryOne(`SELECT COUNT(*) AS total FROM cash_shifts ${where}`, params),
      query(
        `SELECT * FROM cash_shifts ${where} ORDER BY opened_at DESC, id DESC LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([totalRow, rows]) => ({
      total: Number(totalRow?.total || 0),
      rows,
    }));
  },

  // ─── Pergerakan kas (cash in / cash out) ────────────────────────────────
  findMovementsByShift(shiftId) {
    return query(
      "SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY created_at DESC, id DESC",
      [shiftId],
    );
  },

  findMovementById(id) {
    return queryOne("SELECT * FROM cash_movements WHERE id = ?", [id]);
  },

  // Catat pergerakan kas + posting jurnal (Dr/Cr Kas vs Beban/Modal/
  // Pendapatan Lain-lain) dalam satu DB transaction — kalau jurnal gagal,
  // insert pergerakan kas ini ikut rollback.
  createMovement({
    shiftId,
    shiftCode,
    type,
    category,
    amount,
    description,
    createdBy,
    occurredAt,
  }) {
    return transaction(async (conn) => {
      const [result] = await conn.execute(
        `INSERT INTO cash_movements
           (shift_id, type, category, amount, description, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          shiftId,
          type,
          category,
          amount,
          description || "",
          createdBy || "Admin",
          occurredAt,
        ],
      );
      const [rows] = await conn.execute(
        "SELECT * FROM cash_movements WHERE id = ?",
        [result.insertId],
      );
      const movement = rows[0];
      await journalService.postCashMovementJournal(movement, shiftCode, conn);
      return movement;
    });
  },

  // Hapus pergerakan kas + posting jurnal pembalik (Dr/Cr ditukar dari
  // jurnal asal) dalam SATU DB transaction — sama seperti createMovement,
  // supaya General Ledger tidak "lupa" pengeluaran/pemasukan yang
  // catatan cash_movements-nya sudah dihapus kasir. Kalau jurnal
  // pembalik gagal, DELETE ini ikut rollback.
  deleteMovement(id, shiftCode) {
    return transaction(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT * FROM cash_movements WHERE id = ?",
        [id],
      );
      const movement = rows[0];
      if (!movement) return null;

      await journalService.postVoidCashMovementJournal(
        movement,
        shiftCode,
        conn,
      );
      await conn.execute("DELETE FROM cash_movements WHERE id = ?", [id]);
      return movement;
    });
  },

  sumMovements(shiftId) {
    return query(
      `SELECT type, COALESCE(SUM(amount),0) AS total
       FROM cash_movements WHERE shift_id = ? GROUP BY type`,
      [shiftId],
    );
  },

  // Total kas masuk dari penjualan selama rentang shift berjalan/berakhir —
  // dasar perhitungan "saldo kas seharusnya" saat tutup kas.
  // Mencakup 2 sumber yang sama-sama di-debit ke akun Kas (1100) oleh
  // journalService.postSaleJournal():
  //   1) Transaksi tunai penuh (payment_method = 'cash')  → final_amount
  //   2) DP tunai transaksi Open Bill (payment_method = 'open_bill') →
  //      payment_amount (bisa Rp0 kalau Open Bill tanpa DP)
  // PENTING: transaksi non-tunai lain yang JUGA menyentuh akun Kas di jurnal
  // (pembayaran piutang/utang tunai, pembelian tunai, setoran/prive modal
  // tunai, beban operasional) SENGAJA tidak dihitung di sini — modul Kas
  // Kecil ini merepresentasikan laci kasir harian, bukan saldo akun Kas (COA
  // 1100) secara keseluruhan. Kalau di praktiknya transaksi-transaksi itu
  // juga dibayar/diterima dari laci yang sama, saldo di sini akan selisih
  // dari saldo akun Kas di Neraca Saldo — itu ekspektasi yang benar, bukan
  // bug, selama pemakaiannya konsisten.
  // FIX (review dosen): sebelumnya dihitung pakai rentang waktu
  // (created_at BETWEEN opened_at AND closed_at), yang rapuh — transaksi
  // dengan shift_id NULL (dulu bisa terjadi kalau checkout tanpa sesi kas
  // aktif) tidak akan pernah masuk hitungan shift manapun, dan transaksi
  // dekat batas waktu buka/tutup kas berisiko salah shift. Sekarang
  // dihitung berdasarkan transactions.shift_id secara langsung — akurat
  // apapun urutan waktu penutupan/pembukaan sesi berikutnya.
  sumCashSales(shiftId) {
    return queryOne(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN payment_method = 'cash' THEN final_amount
             WHEN payment_method = 'open_bill' THEN payment_amount
             ELSE 0
           END
         ), 0) AS total_cash_sales
       FROM transactions
       WHERE status = 'completed'
         AND shift_id = ?
         AND (payment_method = 'cash' OR (payment_method = 'open_bill' AND payment_amount > 0))`,
      [shiftId],
    );
  },

  // ─── FIX (revisi dosen #17) ─────────────────────────────────────────────
  // Sebelumnya perhitungan tutup kas SENGAJA mengabaikan: pembayaran
  // piutang/hutang tunai, pembelian tunai, setoran/prive modal tunai, dan
  // biaya operasional — padahal kelima-limanya sama-sama mengurangi/
  // menambah laci kasir fisik kalau memang dibayar/diterima dari situ.
  // Sekarang masing-masing ditautkan lewat shift_id (diisi di service layer
  // saat transaksi dicatat, HANYA kalau metode bayarnya tunai/kas DAN ada
  // sesi kas yang sedang terbuka — lihat purchaseService/payableService/
  // receivableService/capitalService/accountingService). Query di bawah
  // menjumlahkan per shift_id, persis pola sumCashSales() di atas.
  sumCashReceivablePayments(shiftId) {
    return queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM receivable_payments
       WHERE shift_id = ?`,
      [shiftId],
    );
  },

  sumCashPayablePayments(shiftId) {
    return queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payable_payments
       WHERE shift_id = ?`,
      [shiftId],
    );
  },

  sumCashPurchases(shiftId) {
    return queryOne(
      `SELECT COALESCE(SUM(total_cost), 0) AS total
       FROM purchases
       WHERE shift_id = ?`,
      [shiftId],
    );
  },

  sumCashCapital(shiftId) {
    return queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'setoran' THEN amount ELSE 0 END), 0) AS total_in,
         COALESCE(SUM(CASE WHEN type = 'penarikan' THEN amount ELSE 0 END), 0) AS total_out
       FROM capital_transactions
       WHERE shift_id = ?`,
      [shiftId],
    );
  },

  sumCashExpenses(shiftId) {
    return queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE shift_id = ?`,
      [shiftId],
    );
  },

  // ─── Laporan Kas Masuk / Kas Keluar (lintas shift, per rentang tanggal) ──
  // Berbeda dari findMovementsByShift() yang dibatasi 1 shift — dipakai
  // untuk rekap Kas Masuk & Kas Keluar di menu Laporan. Ikut sertakan
  // shift_code (JOIN cash_shifts) supaya bisa ditelusuri ke sesi kas asal.
  reportMovements(startDate, endDate) {
    return query(
      `SELECT cm.*, cs.shift_code
       FROM cash_movements cm
       JOIN cash_shifts cs ON cs.id = cm.shift_id
       WHERE DATE(cm.created_at) BETWEEN ? AND ?
       ORDER BY cm.created_at ASC`,
      [startDate, endDate],
    );
  },

  // Modal awal tiap sesi kas yang DIBUKA dalam rentang tanggal — salah satu
  // sumber "Kas Masuk" (lihat permintaan laporan: Kas Awal).
  reportShiftOpenings(startDate, endDate) {
    return query(
      `SELECT id, shift_code, opening_balance, opening_notes, opened_by, opened_at
       FROM cash_shifts
       WHERE DATE(opened_at) BETWEEN ? AND ?
       ORDER BY opened_at ASC`,
      [startDate, endDate],
    );
  },

  // Penjualan tunai (cash) direkap PER HARI (bukan per transaksi — itu sudah
  // ada di Laporan Penjualan Harian) sebagai satu baris "Kas Masuk" per hari,
  // pakai rumus yang sama dengan sumCashSales() di atas.
  reportCashSalesByDay(startDate, endDate) {
    return query(
      `SELECT DATE(created_at) AS sale_date,
          COALESCE(SUM(
            CASE
              WHEN payment_method = 'cash' THEN final_amount
              WHEN payment_method = 'open_bill' THEN payment_amount
              ELSE 0
            END
          ), 0) AS total_cash_sales
       FROM transactions
       WHERE status = 'completed'
         AND (payment_method = 'cash' OR (payment_method = 'open_bill' AND payment_amount > 0))
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       HAVING total_cash_sales > 0
       ORDER BY sale_date ASC`,
      [startDate, endDate],
    );
  },
};

module.exports = cashRegisterModel;
