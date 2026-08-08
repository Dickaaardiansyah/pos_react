// models/journalModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — modul Jurnal Akuntansi: Chart of Accounts (COA), header/detail
// jurnal, serta query agregat untuk Buku Besar & Neraca Saldo. Query mentah
// saja; aturan bisnis (validasi balance, posting otomatis) hidup di
// services/journalService.js.
// ─────────────────────────────────────────────────────────────────────────────
const {
  query,
  queryOne,
  insert,
  execute,
  transaction,
  safeInt,
} = require("../config/database");

const journalModel = {
  // ─── Chart of Accounts ──────────────────────────────────────────────────
  findAllAccounts({ account_type, is_active } = {}) {
    const params = [];
    let where = "WHERE 1=1";
    if (account_type) {
      where += " AND account_type = ?";
      params.push(account_type);
    }
    if (is_active !== undefined && is_active !== null && is_active !== "") {
      where += " AND is_active = ?";
      params.push(is_active ? 1 : 0);
    }
    return query(
      `SELECT * FROM chart_of_accounts ${where} ORDER BY account_code ASC`,
      params,
    );
  },

  findAccountById(id) {
    return queryOne("SELECT * FROM chart_of_accounts WHERE id = ?", [id]);
  },

  findAccountByCode(code) {
    return queryOne("SELECT * FROM chart_of_accounts WHERE account_code = ?", [
      code,
    ]);
  },

  createAccount({
    accountCode,
    accountName,
    accountType,
    normalBalance,
    description,
  }) {
    return insert(
      `INSERT INTO chart_of_accounts
         (account_code, account_name, account_type, normal_balance, description, is_system)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [accountCode, accountName, accountType, normalBalance, description || ""],
    );
  },

  updateAccount(id, existing, patch) {
    return execute(
      `UPDATE chart_of_accounts SET account_name=?, description=?, is_active=? WHERE id=?`,
      [
        patch.accountName ?? existing.account_name,
        patch.description ?? existing.description,
        patch.isActive === undefined
          ? existing.is_active
          : patch.isActive
            ? 1
            : 0,
        id,
      ],
    );
  },

  // ─── Jurnal (header + detail) ───────────────────────────────────────────
  // Insert header + seluruh baris dalam satu transaksi DB — jurnal tidak
  // pernah setengah tersimpan (all-or-nothing).
  //
  // Parameter `conn` (opsional): kalau pemanggil sudah punya koneksi
  // transaksi aktif (mis. transactionModel.createSale yang sedang di dalam
  // transaction(async (conn) => {...})), kirim `conn` itu ke sini supaya
  // insert jurnal ikut MENUMPANG di transaksi yang sama — jadi jurnal dan
  // transaksi bisnisnya commit/rollback bareng (atomic), tidak ada lagi
  // kondisi "transaksi sukses tapi jurnal gagal". Kalau `conn` tidak
  // dikirim (mis. dipanggil dari Jurnal Manual di halaman Jurnal Umum),
  // fungsi ini tetap jalan seperti biasa: buka transaksi sendiri.
  createEntry({
    entryCode,
    entryDate,
    description,
    referenceType,
    referenceId,
    referenceCode,
    source,
    createdBy,
    lines,
    conn: externalConn,
  }) {
    const run = async (conn) => {
      const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

      const [headerResult] = await conn.execute(
        `INSERT INTO journal_entries
           (entry_code, entry_date, description, reference_type, reference_id, reference_code, total_debit, total_credit, source, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entryCode,
          entryDate,
          description || "",
          referenceType || "manual",
          referenceId || null,
          referenceCode || "",
          totalDebit,
          totalCredit,
          source || "manual",
          createdBy || "Sistem",
        ],
      );
      const entryId = headerResult.insertId;

      let order = 0;
      for (const line of lines) {
        await conn.execute(
          `INSERT INTO journal_entry_lines
             (journal_entry_id, account_id, debit, credit, description, line_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            entryId,
            line.account_id,
            line.debit || 0,
            line.credit || 0,
            line.description || "",
            order++,
          ],
        );
      }

      return { id: entryId, entryCode, totalDebit, totalCredit };
    };

    return externalConn ? run(externalConn) : transaction(run);
  },

  findEntryById(id) {
    return queryOne("SELECT * FROM journal_entries WHERE id = ?", [id]);
  },

  findLinesByEntryId(entryId) {
    return query(
      `SELECT jel.*, coa.account_code, coa.account_name, coa.account_type
       FROM journal_entry_lines jel
       JOIN chart_of_accounts coa ON coa.id = jel.account_id
       WHERE jel.journal_entry_id = ?
       ORDER BY jel.line_order ASC, jel.id ASC`,
      [entryId],
    );
  },

  deleteEntry(id) {
    return execute("DELETE FROM journal_entries WHERE id = ?", [id]);
  },

  findEntries({
    startDate,
    endDate,
    referenceType,
    limit = 20,
    offset = 0,
  } = {}) {
    const params = [];
    let where = "WHERE 1=1";
    if (startDate) {
      where += " AND entry_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND entry_date <= ?";
      params.push(endDate);
    }
    if (referenceType) {
      where += " AND reference_type = ?";
      params.push(referenceType);
    }

    return Promise.all([
      queryOne(
        `SELECT COUNT(*) AS total FROM journal_entries ${where}`,
        params,
      ),
      query(
        `SELECT * FROM journal_entries ${where} ORDER BY entry_date DESC, id DESC LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([totalRow, rows]) => ({
      total: Number(totalRow?.total || 0),
      rows,
    }));
  },

  // ─── Buku Besar (General Ledger) ────────────────────────────────────────
  // Saldo awal akun sebelum start_date (agregat seluruh baris jurnal < tanggal).
  accountOpeningBalance(accountId, startDate) {
    if (!startDate) {
      return Promise.resolve({ total_debit: 0, total_credit: 0 });
    }
    return queryOne(
      `SELECT COALESCE(SUM(jel.debit),0) AS total_debit, COALESCE(SUM(jel.credit),0) AS total_credit
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE jel.account_id = ? AND je.entry_date < ?`,
      [accountId, startDate],
    );
  },

  // Mutasi (baris jurnal) suatu akun dalam rentang tanggal, diurutkan kronologis
  // — dasar perhitungan saldo berjalan (running balance) buku besar.
  accountLedgerLines(accountId, startDate, endDate) {
    const params = [accountId];
    let where = "WHERE jel.account_id = ?";
    if (startDate) {
      where += " AND je.entry_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND je.entry_date <= ?";
      params.push(endDate);
    }

    return query(
      `SELECT jel.id, jel.debit, jel.credit, jel.description AS line_description,
              je.id AS journal_entry_id, je.entry_code, je.entry_date, je.description,
              je.reference_type, je.reference_code
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       ${where}
       ORDER BY je.entry_date ASC, je.id ASC, jel.id ASC`,
      params,
    );
  },

  // ─── Neraca Saldo (Trial Balance) ───────────────────────────────────────
  // Total debit/kredit tiap akun s/d tanggal tertentu (untuk semua akun aktif).
  trialBalanceRows(asOfDate) {
    const params = [];
    let dateFilter = "";
    if (asOfDate) {
      dateFilter = "AND je.entry_date <= ?";
      params.push(asOfDate);
    }
    return query(
      `SELECT coa.id, coa.account_code, coa.account_name, coa.account_type, coa.normal_balance,
              COALESCE(SUM(jel.debit),0) AS total_debit,
              COALESCE(SUM(jel.credit),0) AS total_credit
       FROM chart_of_accounts coa
       LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
       LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id ${dateFilter}
       WHERE coa.is_active = 1
       GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.normal_balance
       ORDER BY coa.account_code ASC`,
      params,
    );
  },
  // ─── Arus Kas (Cash Flow) — mutasi akun Kas (1100) & Kas di Bank (1150) ──
  // Saldo kas sebelum start_date (dasar "Saldo Kas Awal" laporan arus kas).
  cashOpeningBalance(kasAccountId, bankAccountId, startDate) {
    if (!startDate) {
      return Promise.resolve({ total_debit: 0, total_credit: 0 });
    }
    return queryOne(
      `SELECT COALESCE(SUM(jel.debit),0) AS total_debit, COALESCE(SUM(jel.credit),0) AS total_credit
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE jel.account_id IN (?, ?) AND je.entry_date < ?`,
      [kasAccountId, bankAccountId, startDate],
    );
  },

  // Mutasi kas dalam rentang tanggal, dikelompokkan per jenis transaksi
  // (reference_type) — dasar pengelompokan Aktivitas Operasi/Investasi/
  // Pendanaan pada laporan arus kas (lihat journalService.cashFlowReport()).
  cashMovementsByReferenceType(
    kasAccountId,
    bankAccountId,
    startDate,
    endDate,
  ) {
    const params = [kasAccountId, bankAccountId];
    let where = "WHERE jel.account_id IN (?, ?)";
    if (startDate) {
      where += " AND je.entry_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND je.entry_date <= ?";
      params.push(endDate);
    }
    return query(
      `SELECT je.reference_type,
              COALESCE(SUM(jel.debit),0) AS total_debit,
              COALESCE(SUM(jel.credit),0) AS total_credit,
              COUNT(*) AS line_count
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       ${where}
       GROUP BY je.reference_type`,
      params,
    );
  },

  // Rincian tiap baris mutasi kas (untuk tabel detail transaksi arus kas),
  // diurutkan kronologis supaya bisa dihitung saldo berjalan seperti Buku Besar.
  cashMovementDetails(kasAccountId, bankAccountId, startDate, endDate) {
    const params = [kasAccountId, bankAccountId];
    let where = "WHERE jel.account_id IN (?, ?)";
    if (startDate) {
      where += " AND je.entry_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND je.entry_date <= ?";
      params.push(endDate);
    }
    return query(
      `SELECT je.entry_date, je.entry_code, je.description, je.reference_type,
              je.reference_code, jel.debit, jel.credit, coa.account_code, coa.account_name
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       JOIN chart_of_accounts coa ON coa.id = jel.account_id
       ${where}
       ORDER BY je.entry_date ASC, je.id ASC, jel.id ASC`,
      params,
    );
  },
};

module.exports = journalModel;
