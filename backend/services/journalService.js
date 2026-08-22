// services/journalService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — Jurnal Akuntansi Otomatis (Double-Entry Bookkeeping).
//
// Bagian 1: Engine inti — validasi & posting jurnal umum, Chart of Accounts,
//           Buku Besar, Neraca Saldo.
// Bagian 2: POSTING OTOMATIS — satu fungsi per jenis transaksi bisnis, yang
//           dipanggil dari service modul terkait (transactionService,
//           purchaseService, accountingService, cashRegisterService,
//           stockOpnameService) setelah operasi utama berhasil disimpan.
//
const journalModel = require("../models/journalModel");
const { ValidationError, NotFoundError } = require("./productService");

// Waktu lokal server (bukan UTC) — didefinisikan lokal (bukan di-import dari
// transactionService) untuk menghindari circular require, karena
// transactionService.js sendiri meng-import journalService.js.
function toLocalDatetime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ─── Kode akun sistem yang dipakai posting otomatis ────────────────────────
const ACC = {
  KAS: "1100",
  BANK: "1150",
  PERSEDIAAN: "1200",
  PIUTANG: "1300",
  UTANG_USAHA: "2100",
  UTANG_BANK: "2200",
  UTANG_LAINNYA: "2300",
  MODAL_PEMILIK: "3100",
  PRIVE: "3200",
  SALDO_AWAL: "3300",
  PENJUALAN: "4100",
  DISKON_PENJUALAN: "4200",
  PENDAPATAN_LAIN: "4900",
  HPP: "5100",
  BEBAN_KAS_KECIL: "5310",
  BEBAN_BUNGA_PINJAMAN: "5320",
  SELISIH_KAS: "5900",
  SELISIH_STOK: "5910",
};

// type di tabel other_payables → kode akun kewajiban yang sesuai
const OTHER_PAYABLE_TYPE_ACCOUNT = {
  pinjaman_bank: "2200", // ACC.UTANG_BANK
  utang_lainnya: "2300", // ACC.UTANG_LAINNYA
};

// Kategori biaya operasional (accountingService) → kode akun beban
const EXPENSE_CATEGORY_ACCOUNT = {
  sewa: "5210",
  gaji: "5220",
  listrik_air: "5230",
  pemasaran: "5240",
  transportasi: "5250",
  perawatan: "5260",
  administrasi: "5270",
  lainnya: "5280",
};

const EXPENSE_ACCRUAL_ACCOUNT = {
  gaji: "2110",
  listrik_air: "2120",
  lainnya: "2130",
};

// Kategori cash-out kas kecil (cashRegisterService) → kode akun beban
const CASH_OUT_CATEGORY_ACCOUNT = {
  kembalian_kurang: ACC.SELISIH_KAS,
  // sedekah_donasi, transportasi, konsumsi, perlengkapan, lainnya → beban kas kecil
};

// Kategori cash-in kas kecil → kode akun kredit
const CASH_IN_CATEGORY_ACCOUNT = {
  setoran_modal: ACC.MODAL_PEMILIK,
  // pengembalian, lainnya → pendapatan lain-lain
};

// ─── Jurnal Penyesuaian (Adjusting Entries) — template siap pakai ─────────
// Setiap template = pola 2 baris (debit/kredit) dengan akun yang sudah
// dipastikan ada (lihat database/adjustment_journal.sql). Frontend hanya
// perlu mengisi tanggal, nominal, dan keterangan tambahan (opsional) —
// tidak perlu tahu/hafal kode akun. `reversible: true` berarti template ini
// lazimnya perlu jurnal pembalik di awal periode berikutnya (akrual beban),
// supaya saat beban itu benar-benar dibayar tidak tercatat dobel.
const ADJUSTMENT_TEMPLATES = [
  {
    id: "accrual_gaji",
    label: "Akrual Beban Gaji (belum dibayar)",
    hint: "Gaji karyawan periode berjalan yang belum dibayar sampai tanggal penyesuaian.",
    reversible: true,
    lines: [
      {
        account_code: "5220",
        side: "debit",
        description: "Beban gaji karyawan (akrual)",
      },
      { account_code: "2110", side: "credit", description: "Utang gaji" },
    ],
  },
  {
    id: "accrual_listrik",
    label: "Akrual Beban Listrik & Air (belum dibayar)",
    hint: "Tagihan listrik/air periode berjalan yang belum dibayar sampai tanggal penyesuaian.",
    reversible: true,
    lines: [
      {
        account_code: "5230",
        side: "debit",
        description: "Beban listrik & air (akrual)",
      },
      {
        account_code: "2120",
        side: "credit",
        description: "Utang listrik & air",
      },
    ],
  },
  {
    id: "accrual_lainnya",
    label: "Akrual Beban Lainnya (masih harus dibayar)",
    hint: "Beban operasional lain (di luar gaji & listrik/air) yang sudah terjadi tapi belum dibayar.",
    reversible: true,
    lines: [
      {
        account_code: "5280",
        side: "debit",
        description: "Beban operasional lainnya (akrual)",
      },
      {
        account_code: "2130",
        side: "credit",
        description: "Utang beban lainnya",
      },
    ],
  },
  // Catatan: template "Terima DP" & "Pengakuan Pendapatan dari DP" (unearned
  // revenue, akun 2400) sengaja DIHAPUS dari sini. Template itu hanya berlaku
  // untuk kasus barang belum dikirim sama sekali saat DP diterima — sedangkan
  // di toko ini semua DP pelanggan selalu disertai penyerahan barang (baik
  // langsung maupun menyusul dikirim), jadi selalu masuk pola Open Bill di
  // Kasir (Dr Kas [DP] + Dr Piutang [sisa], Cr Penjualan) yang SUDAH otomatis
  // ter-posting saat checkout — lihat postSaleJournal() di bawah. Tidak perlu
  // lagi input manual lewat Jurnal Penyesuaian untuk kasus DP.
];


const CASH_FLOW_ACTIVITY = {
  sale: "operasi",
  purchase: "operasi",
  expense: "operasi",
  expense_void: "operasi",
  cash_movement: "operasi",
  cash_movement_void: "operasi",
  cash_shift_close: "operasi",
  stock_opname: "operasi",
  receivable_payment: "operasi",
  receivable_creation: "operasi",
  payable_payment: "operasi",
  payable_creation: "operasi",
  manual: "operasi",
  adjustment: "operasi",
  capital: "pendanaan",
  void: "operasi",
  other_payable: "pendanaan",
  other_payable_payment: "pendanaan",
};

const CASH_FLOW_LABELS = {
  sale: "Penerimaan Penjualan",
  purchase: "Pembayaran Pembelian Barang Dagang",
  expense: "Pembayaran Beban Operasional",
  expense_void: "Pembatalan Pembayaran Beban",
  cash_movement: "Kas Masuk/Keluar Kas Kecil",
  cash_movement_void: "Pembatalan Kas Masuk/Keluar Kas Kecil",
  cash_shift_close: "Penyesuaian Selisih Tutup Kas",
  stock_opname: "Penyesuaian Stock Opname (Kas)",
  receivable_payment: "Penerimaan Pembayaran Piutang",
  receivable_creation: "Pencatatan Piutang Manual",
  payable_payment: "Pembayaran Hutang Supplier",
  payable_creation: "Pencatatan Hutang Manual",
  manual: "Jurnal Manual Lainnya",
  adjustment: "Jurnal Penyesuaian",
  capital: "Setoran / Penarikan Modal Usaha",
  void: "Pembatalan Transaksi Penjualan",
  other_payable: "Penerimaan Pinjaman Bank / Utang Lainnya",
  other_payable_payment: "Pembayaran Cicilan Pinjaman (Pokok + Bunga)",
};

const CASH_FLOW_SECTION_LABELS = {
  operasi: "Aktivitas Operasi",
  investasi: "Aktivitas Investasi",
  pendanaan: "Aktivitas Pendanaan",
};

function defaultCashFlowRange(startDate, endDate) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return {
    startDate: startDate || toISO(firstDay),
    endDate: endDate || toISO(now),
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const EXPECTED_BALANCE_SIDE_OVERRIDE = {
  4200: "debit", // Diskon Penjualan — kontra Pendapatan, selalu didebit
  3200: "debit", // Prive — kontra Modal, selalu didebit
};

// SUSPENSE_ACCOUNT_CODES = akun "penampung dua arah" yang MEMANG didesain
// bisa didebit maupun dikredit tergantung skenario, bukan tanda kesalahan —
// dikecualikan sepenuhnya dari validasi ini:
//   3300 Saldo Awal/Penyesuaian — lawan akun Hutang manual (didebit, lihat
//   postPayableCreationJournal) MAUPUN Piutang manual (dikredit, lihat
//   postReceivableCreationJournal), jadi tidak punya satu "arah normal".
const SUSPENSE_ACCOUNT_CODES = new Set(["3300"]);

function checkAbnormalBalance(row) {
  const totalDebit = Number(row.total_debit) || 0;
  const totalCredit = Number(row.total_credit) || 0;
  const hasActivity = totalDebit > 0 || totalCredit > 0;
  if (!hasActivity || SUSPENSE_ACCOUNT_CODES.has(row.account_code)) {
    return { is_abnormal: false, abnormal_note: null };
  }

  const expectedSide =
    EXPECTED_BALANCE_SIDE_OVERRIDE[row.account_code] || row.normal_balance;
  const validationBalance =
    expectedSide === "debit"
      ? round2(totalDebit - totalCredit)
      : round2(totalCredit - totalDebit);

  if (validationBalance >= -0.01) {
    return { is_abnormal: false, abnormal_note: null };
  }

  const actualSide = expectedSide === "debit" ? "kredit" : "debit";
  const rupiah = Math.abs(validationBalance).toLocaleString("id-ID");
  return {
    is_abnormal: true,
    abnormal_note: `${row.account_name} (${row.account_code}) seharusnya bersaldo ${expectedSide}, tapi hasil perhitungan menunjukkan sisi ${actualSide} sebesar Rp${rupiah} — periksa kemungkinan salah jurnal (sisi debit/kredit tertukar).`,
  };
}

function generateEntryCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  
  const rand = Math.floor(Math.random() * 900000 + 100000);
  return `JU${date}${rand}`;
}

async function accountIdByCode(code) {
  const acc = await journalModel.findAccountByCode(code);
  if (!acc)
    throw new Error(
      `Akun sistem dengan kode ${code} tidak ditemukan — pastikan database/journal.sql sudah dijalankan`,
    );
  return acc.id;
}

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 1 — ENGINE INTI
// ═══════════════════════════════════════════════════════════════════════════
const journalService = {
  // ─── Chart of Accounts ───────────────────────────────────────────────────
  listAccounts(filters) {
    return journalModel.findAllAccounts(filters);
  },

  async createAccount(payload) {
    const {
      account_code,
      account_name,
      account_type,
      normal_balance,
      description,
    } = payload;
    if (!account_code || !account_name || !account_type || !normal_balance) {
      throw new ValidationError(
        "Kode akun, nama akun, tipe akun, dan saldo normal wajib diisi",
      );
    }
    if (
      !["aset", "kewajiban", "modal", "pendapatan", "beban"].includes(
        account_type,
      )
    ) {
      throw new ValidationError("Tipe akun tidak valid");
    }
    if (!["debit", "kredit"].includes(normal_balance)) {
      throw new ValidationError("Saldo normal harus 'debit' atau 'kredit'");
    }
    const existing = await journalModel.findAccountByCode(account_code);
    if (existing) throw new ValidationError("Kode akun sudah digunakan");

    const result = await journalModel.createAccount({
      accountCode: account_code,
      accountName: account_name,
      accountType: account_type,
      normalBalance: normal_balance,
      description,
    });
    return journalModel.findAccountById(result.insertId);
  },

  async updateAccount(id, payload) {
    const existing = await journalModel.findAccountById(id);
    if (!existing) throw new NotFoundError("Akun tidak ditemukan");
    if (existing.is_system && payload.is_active === false) {
      throw new ValidationError(
        "Akun sistem tidak dapat dinonaktifkan karena dipakai posting otomatis",
      );
    }
    await journalModel.updateAccount(id, existing, {
      accountName: payload.account_name,
      description: payload.description,
      isActive: payload.is_active,
    });
    return journalModel.findAccountById(id);
  },

  // ─── Posting jurnal (inti double-entry) ─────────────────────────────────
  // lines: [{ account_code | account_id, debit, credit, description }]
  // Melempar ValidationError jika total debit != total kredit (tidak balance).
  async postEntry({
    entryDate,
    description,
    referenceType,
    referenceId,
    referenceCode,
    source,
    createdBy,
    createdByUserId,
    lines,
    reversalOfId,
    conn,
  }) {
    if (!lines || lines.length < 2) {
      throw new ValidationError(
        "Jurnal minimal harus punya 2 baris (debit & kredit)",
      );
    }

    const resolvedLines = [];
    for (const line of lines) {
      const accountId =
        line.account_id ||
        (line.account_code ? await accountIdByCode(line.account_code) : null);
      if (!accountId)
        throw new ValidationError("Setiap baris jurnal wajib memiliki akun");
      const debit = round2(line.debit || 0);
      const credit = round2(line.credit || 0);
      // FIX KEAMANAN/INTEGRITAS DATA: sebelumnya hanya dicek "debit dan
      // kredit tidak boleh sama-sama > 0" — nilai NEGATIF pada salah satunya
      // tetap lolos. Debit/kredit negatif secara matematis bisa membuat
      // total_debit == total_credit (jurnal "balance") padahal artinya
      // terbalik (debit negatif = kredit terselubung), mengorupsi saldo akun
      // tanpa transaksi riil. Guard ini berlaku untuk SEMUA pemanggil
      // postEntry() (penjualan, kas kecil, pembelian, dst.), bukan cuma
      // kasus diskon — supaya sumber bug serupa di masa depan tidak lolos.
      if (debit < 0 || credit < 0) {
        throw new ValidationError("Baris jurnal tidak boleh bernilai negatif");
      }
      if (debit > 0 && credit > 0) {
        throw new ValidationError(
          "Satu baris jurnal tidak boleh mengisi debit dan kredit sekaligus",
        );
      }
      if (debit === 0 && credit === 0) continue; // baris kosong, lewati
      resolvedLines.push({
        account_id: accountId,
        debit,
        credit,
        description: line.description || "",
      });
    }

    const totalDebit = round2(resolvedLines.reduce((s, l) => s + l.debit, 0));
    const totalCredit = round2(resolvedLines.reduce((s, l) => s + l.credit, 0));
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new ValidationError(
        `Jurnal tidak balance: total debit ${totalDebit} ≠ total kredit ${totalCredit}`,
      );
    }
    if (totalDebit === 0) {
      throw new ValidationError("Jurnal tidak boleh bernilai nol");
    }

    const result = await journalModel.createEntry({
      entryCode: generateEntryCode(),
      entryDate: entryDate || toLocalDatetime().slice(0, 10),
      description,
      referenceType,
      referenceId,
      referenceCode,
      source: source || "manual",
      createdBy,
      createdByUserId,
      lines: resolvedLines,
      reversalOfId,
      conn,
    });
    // Kalau posting ini menumpang transaksi DB milik pemanggil (conn dikirim),
    // baris jurnal belum ter-commit di titik ini — jangan query balik pakai
    // koneksi lain (bisa deadlock / belum kelihatan). Cukup kembalikan info
    // dasarnya; detail lengkap tetap bisa diambil lewat getEntryDetail(id)
    // setelah transaksi induk commit.
    if (conn) {
      return { id: result.id, entry_code: result.entryCode, ...result };
    }
    return journalService.getEntryDetail(result.id);
  },

  postManualEntry(payload, user) {
    const { entry_date, description, lines } = payload;
    if (!entry_date) throw new ValidationError("Tanggal jurnal wajib diisi");
    return journalService.postEntry({
      entryDate: entry_date,
      description,
      referenceType: "manual",
      source: "manual",
      createdBy: user?.name || "Admin",
      createdByUserId: user?.id ?? null,
      lines: (lines || []).map((l) => ({
        account_code: l.account_code,
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      })),
    });
  },

  async deleteEntry(id) {
    const entry = await journalModel.findEntryById(id);
    if (!entry) throw new NotFoundError("Jurnal tidak ditemukan");
    if (entry.source !== "manual") {
      throw new ValidationError(
        "Jurnal hasil posting otomatis tidak dapat dihapus langsung. Buat jurnal koreksi (manual) untuk membatalkannya",
      );
    }

    if (entry.status !== "draft") {
      throw new ValidationError(
        'Jurnal yang sudah diposting tidak dapat dihapus (demi jejak audit). Gunakan jurnal pembalik ("Balik") untuk mengoreksinya.',
      );
    }
    await journalModel.deleteEntry(id);
  },

  // ─── Jurnal Penyesuaian (Adjusting Entries) ─────────────────────────────
  listAdjustmentTemplates() {
    return ADJUSTMENT_TEMPLATES;
  },

  postAdjustingEntry(payload, user) {
    const { entry_date, description, lines, template_id } = payload;
    if (!entry_date) throw new ValidationError("Tanggal jurnal wajib diisi");
    if (!lines || lines.length < 2) {
      throw new ValidationError(
        "Jurnal penyesuaian minimal harus punya 2 baris (debit & kredit)",
      );
    }
    return journalService.postEntry({
      entryDate: entry_date,
      description: description || "Jurnal penyesuaian",
      referenceType: "adjustment",
      referenceCode: template_id || "",
      source: "manual",
      createdBy: user?.name || "Admin",
      createdByUserId: user?.id ?? null,
      lines: lines.map((l) => ({
        account_code: l.account_code,
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      })),
    });
  },

  async reverseEntry(id, { entry_date } = {}, user) {
    const original = await journalModel.findEntryById(id);
    if (!original) throw new NotFoundError("Jurnal tidak ditemukan");

    if (original.status === "draft") {
      throw new ValidationError(
        "Jurnal draft belum diposting, tidak perlu/tidak bisa dibalik",
      );
    }

    const existingReversal = await journalModel.findReversalOf(id);
    if (existingReversal) {
      throw new ValidationError(
        `Jurnal ini sudah pernah dibalik lewat ${existingReversal.entry_code}`,
      );
    }

    const originalLines = await journalModel.findLinesByEntryId(id);
    if (!originalLines.length) {
      throw new ValidationError("Jurnal asal tidak punya baris untuk dibalik");
    }

    const lines = originalLines.map((l) => ({
      account_id: l.account_id,
      debit: Number(l.credit) || 0,
      credit: Number(l.debit) || 0,
      description: l.line_description || l.description || "",
    }));

    const reversal = await journalService.postEntry({
      entryDate: entry_date || toLocalDatetime().slice(0, 10),
      description: `Jurnal pembalik — ${original.description || original.entry_code}`,
      referenceType: "adjustment",
      referenceCode: original.entry_code,
      source: "manual",
      createdBy: user?.name || "Admin",
      createdByUserId: user?.id ?? null,
      lines,
      reversalOfId: id,
    });

    await journalModel.markReversed(id);

    return reversal;
  },

  async list({ start_date, end_date, reference_type, page = 1, limit = 20 }) {
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const { total, rows } = await journalModel.findEntries({
      startDate: start_date,
      endDate: end_date,
      referenceType: reference_type,
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit,
    });
    return { data: rows, total, page: parsedPage, limit: parsedLimit };
  },

  async getEntryDetail(id) {
    const entry = await journalModel.findEntryById(id);
    if (!entry) throw new NotFoundError("Jurnal tidak ditemukan");
    const lines = await journalModel.findLinesByEntryId(id);
    return { ...entry, lines };
  },

  // ─── Saldo akun saat ini (live balance) ──────────────────────────────────
  // Dipakai untuk validasi "saldo cukup/tidak" SEBELUM mencatat pembayaran
  // tunai yang sumber dananya Kas/Bank KANTOR (bukan laci kasir per-shift —
  // itu pakai cashRegisterService.getActiveShift().expected_balance, ruang
  // lingkupnya beda, lihat catatan skop di cashRegisterService.js).
  // Menghitung seluruh mutasi akun (dari awal) sampai as_of_date (default:
  // hari ini), jadi hasilnya = saldo akun tsb di buku besar per tanggal itu.
  async getCurrentBalance(accountCode, as_of_date) {
    const account = await journalModel.findAccountByCode(accountCode);
    if (!account) return 0;
    const asOfDate = as_of_date || toLocalDatetime().slice(0, 10);
    // accountOpeningBalance() menjumlahkan baris dengan entry_date < startDate
    // (eksklusif) — kirim H+1 dari asOfDate supaya mutasi PADA asOfDate ikut
    // terhitung.
    const d = new Date(`${asOfDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const pad = (n) => String(n).padStart(2, "0");
    const exclusiveUpperBound = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const totals = await journalModel.accountOpeningBalance(
      account.id,
      exclusiveUpperBound,
    );
    const isDebitNormal = account.normal_balance === "debit";
    return isDebitNormal
      ? round2(Number(totals.total_debit) - Number(totals.total_credit))
      : round2(Number(totals.total_credit) - Number(totals.total_debit));
  },

  // ─── Buku Besar (General Ledger) ─────────────────────────────────────────
  async generalLedger({ account_id, account_code, start_date, end_date }) {
    const account = account_id
      ? await journalModel.findAccountById(account_id)
      : await journalModel.findAccountByCode(account_code);
    if (!account) throw new NotFoundError("Akun tidak ditemukan");

    const opening = await journalModel.accountOpeningBalance(
      account.id,
      start_date,
    );
    const isDebitNormal = account.normal_balance === "debit";
    const openingBalance = isDebitNormal
      ? round2(Number(opening.total_debit) - Number(opening.total_credit))
      : round2(Number(opening.total_credit) - Number(opening.total_debit));

    const lines = await journalModel.accountLedgerLines(
      account.id,
      start_date,
      end_date,
    );
    let running = openingBalance;
    const mutations = lines.map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      running = isDebitNormal
        ? round2(running + debit - credit)
        : round2(running + credit - debit);
      return { ...l, running_balance: running };
    });

    return {
      account,
      opening_balance: openingBalance,
      closing_balance: running,
      mutations,
    };
  },

  // ─── Neraca Saldo (Trial Balance) ────────────────────────────────────────
  // `exclude_adjustments`: "true" → Neraca Saldo (Awal), saldo SEBELUM
  // jurnal penyesuaian. Kosong/lainnya → Neraca Saldo Disesuaikan, saldo
  // SETELAH jurnal penyesuaian (default, sama seperti perilaku sebelumnya).
  async trialBalance({ as_of_date, exclude_adjustments }) {
    const rows = await journalModel.trialBalanceRows(
      as_of_date,
      exclude_adjustments === "true" || exclude_adjustments === true,
    );
    const result = rows.map((r) => {
      const totalDebit = Number(r.total_debit);
      const totalCredit = Number(r.total_credit);
      const balance =
        r.normal_balance === "debit"
          ? round2(totalDebit - totalCredit)
          : round2(totalCredit - totalDebit);
      const { is_abnormal, abnormal_note } = checkAbnormalBalance(r);
      return {
        account_id: r.id,
        account_code: r.account_code,
        account_name: r.account_name,
        account_type: r.account_type,
        normal_balance: r.normal_balance,
        total_debit: round2(totalDebit),
        total_credit: round2(totalCredit),
        balance,
        is_abnormal,
        abnormal_note,
      };
    });

    const totalAsetKewajibanModal = {
      aset: 0,
      kewajiban: 0,
      modal: 0,
      pendapatan: 0,
      beban: 0,
    };
    result.forEach((r) => {
      totalAsetKewajibanModal[r.account_type] += r.balance;
    });

    const labaRugiBerjalan = round2(
      totalAsetKewajibanModal.pendapatan - totalAsetKewajibanModal.beban,
    );

    const totalDebitAll = round2(result.reduce((s, r) => s + r.total_debit, 0));
    const totalCreditAll = round2(
      result.reduce((s, r) => s + r.total_credit, 0),
    );
    const selisihDebitKredit = round2(totalDebitAll - totalCreditAll);

    const abnormalAccounts = result
      .filter((r) => r.is_abnormal)
      .map((r) => ({
        account_code: r.account_code,
        account_name: r.account_name,
        normal_balance: r.normal_balance,
        balance: r.balance,
        note: r.abnormal_note,
      }));

    return {
      accounts: result,
      summary: {
        total_debit: totalDebitAll,
        total_credit: totalCreditAll,
        selisih_debit_kredit: selisihDebitKredit,
        is_seimbang: Math.abs(selisihDebitKredit) < 0.01,
        total_aset: round2(totalAsetKewajibanModal.aset),
        total_kewajiban: round2(totalAsetKewajibanModal.kewajiban),
        total_modal: round2(totalAsetKewajibanModal.modal),
        total_pendapatan: round2(totalAsetKewajibanModal.pendapatan),
        total_beban: round2(totalAsetKewajibanModal.beban),
        laba_rugi_berjalan: labaRugiBerjalan,
        // Neraca harus balance: Aset = Kewajiban + Modal + Laba Berjalan
        selisih_neraca: round2(
          totalAsetKewajibanModal.aset -
            (totalAsetKewajibanModal.kewajiban +
              totalAsetKewajibanModal.modal +
              labaRugiBerjalan),
        ),
        has_saldo_abnormal: abnormalAccounts.length > 0,
        jumlah_akun_abnormal: abnormalAccounts.length,
        akun_abnormal: abnormalAccounts,
      },
    };
  },

  // ─── Neraca (Balance Sheet / Laporan Posisi Keuangan) ───────────────────
  // Beda dengan Neraca Saldo di atas (yang menampilkan SEMUA akun mentah
  // untuk keperluan pengecekan total debit = total kredit): Neraca menyusun
  // ulang saldo akun per bagian standar laporan keuangan (Aset / Kewajiban
  // / Modal) dan memasukkan Laba (Rugi) Berjalan — Pendapatan dikurangi
  // Beban sejak awal pembukuan s/d tanggal ini — sebagai satu baris di
  // bagian Modal, supaya Aset selalu = Kewajiban + Modal tanpa perlu jurnal
  // tutup buku (closing entry) di akhir periode. Sumber datanya sama persis
  // dengan Neraca Saldo (journalModel.trialBalanceRows), jadi otomatis
  // konsisten satu sama lain.
  async balanceSheet({ as_of_date }) {
    const asOfDate = as_of_date || toLocalDatetime().slice(0, 10);
    const rows = await journalModel.trialBalanceRows(asOfDate);

    const toLine = (r) => {
      const totalDebit = Number(r.total_debit);
      const totalCredit = Number(r.total_credit);
      const balance =
        r.normal_balance === "debit"
          ? round2(totalDebit - totalCredit)
          : round2(totalCredit - totalDebit);
      return {
        account_id: r.id,
        account_code: r.account_code,
        account_name: r.account_name,
        balance,
      };
    };

    const byType = (type) =>
      rows
        .filter((r) => r.account_type === type)
        .map(toLine)
        .filter((l) => l.balance !== 0);

    const asetAccounts = byType("aset");
    const kewajibanAccounts = byType("kewajiban");
    const modalAccounts = byType("modal");

    const totalKas = round2(
      asetAccounts
        .filter((a) => a.account_code === "1100" || a.account_code === "1150")
        .reduce((s, a) => s + a.balance, 0),
    );

    const totalPendapatan = round2(
      rows
        .filter((r) => r.account_type === "pendapatan")
        .reduce(
          (s, r) => s + (Number(r.total_credit) - Number(r.total_debit)),
          0,
        ),
    );
    const totalBeban = round2(
      rows
        .filter((r) => r.account_type === "beban")
        .reduce(
          (s, r) => s + (Number(r.total_debit) - Number(r.total_credit)),
          0,
        ),
    );
    const labaBerjalan = round2(totalPendapatan - totalBeban);

    const totalAset = round2(asetAccounts.reduce((s, a) => s + a.balance, 0));
    const totalKewajiban = round2(
      kewajibanAccounts.reduce((s, a) => s + a.balance, 0),
    );
    const totalModalAkun = round2(
      modalAccounts.reduce((s, a) => s + a.balance, 0),
    );
    const totalModal = round2(totalModalAkun + labaBerjalan);
    const totalKewajibanDanModal = round2(totalKewajiban + totalModal);
    const selisih = round2(totalAset - totalKewajibanDanModal);

    return {
      as_of_date: asOfDate,
      aset: { accounts: asetAccounts, total: totalAset, total_kas: totalKas },
      kewajiban: { accounts: kewajibanAccounts, total: totalKewajiban },
      modal: {
        accounts: modalAccounts,
        laba_berjalan: labaBerjalan,
        total: totalModal,
      },
      total_kewajiban_dan_modal: totalKewajibanDanModal,
      selisih,
      is_balanced: Math.abs(selisih) < 0.01,
    };
  },

  // ─── Laporan Arus Kas (Cash Flow Statement — metode langsung) ───────────
  // Dibangun dari jurnal (bukan tabel terpisah), sama seperti Buku Besar &
  // Neraca Saldo: mengambil seluruh mutasi akun Kas (1100) + Kas di Bank
  // (1150), dikelompokkan per jenis transaksi lalu dipetakan ke 3 aktivitas
  // standar (Operasi/Investasi/Pendanaan). Saldo Kas Akhir = Saldo Awal +
  // seluruh arus kas bersih periode ini — HARUS sama dengan saldo akun Kas
  // + Bank pada Neraca Saldo per tanggal akhir, karena sumber datanya sama.
  async cashFlowReport({ start_date, end_date }) {
    const { startDate, endDate } = defaultCashFlowRange(start_date, end_date);
    const kasId = await accountIdByCode(ACC.KAS);
    const bankId = await accountIdByCode(ACC.BANK);

    const [opening, movementRows] = await Promise.all([
      journalModel.cashOpeningBalance(kasId, bankId, startDate),
      journalModel.cashMovementsByReferenceType(
        kasId,
        bankId,
        startDate,
        endDate,
      ),
    ]);

    const openingBalance = round2(
      Number(opening.total_debit) - Number(opening.total_credit),
    );

    const activities = {
      operasi: {
        label: CASH_FLOW_SECTION_LABELS.operasi,
        inflow: 0,
        outflow: 0,
        net: 0,
        items: [],
      },
      investasi: {
        label: CASH_FLOW_SECTION_LABELS.investasi,
        inflow: 0,
        outflow: 0,
        net: 0,
        items: [],
      },
      pendanaan: {
        label: CASH_FLOW_SECTION_LABELS.pendanaan,
        inflow: 0,
        outflow: 0,
        net: 0,
        items: [],
      },
    };

    movementRows.forEach((r) => {
      const section = CASH_FLOW_ACTIVITY[r.reference_type] || "operasi";
      const inflow = round2(Number(r.total_debit));
      const outflow = round2(Number(r.total_credit));
      activities[section].inflow = round2(activities[section].inflow + inflow);
      activities[section].outflow = round2(
        activities[section].outflow + outflow,
      );
      activities[section].items.push({
        reference_type: r.reference_type,
        label: CASH_FLOW_LABELS[r.reference_type] || r.reference_type,
        inflow,
        outflow,
        net: round2(inflow - outflow),
      });
    });

    Object.values(activities).forEach((a) => {
      a.net = round2(a.inflow - a.outflow);
      a.items.sort((x, y) => y.net - x.net);
    });

    const netCashFlow = round2(
      activities.operasi.net +
        activities.investasi.net +
        activities.pendanaan.net,
    );
    const closingBalance = round2(openingBalance + netCashFlow);

    return {
      startDate,
      endDate,
      openingBalance,
      closingBalance,
      netCashFlow,
      activities,
    };
  },

  async systemValidation({ as_of_date } = {}) {
    const asOfDate = as_of_date || toLocalDatetime().slice(0, 10);
    // "Sejak awal pembukuan" — dipakai supaya Laba Rugi yang dibandingkan
    // benar-benar KUMULATIF sejak awal s/d asOfDate, sepadan dengan Laba
    // Berjalan di Neraca yang juga dihitung kumulatif (lihat balanceSheet()
    // & trialBalanceRows() — tidak difilter start_date).
    const INCEPTION_DATE = "2000-01-01";

    // require di dalam fungsi (bukan top-level) untuk menghindari circular
    // require: accountingService.js sendiri meng-import journalModel, dan
    // beberapa model lain meng-import journalService.js di top-level.
    const accountingService = require("./accountingService");

    const [trial, sheet, cashFlow, incomeStatement] = await Promise.all([
      journalService.trialBalance({ as_of_date: asOfDate }),
      journalService.balanceSheet({ as_of_date: asOfDate }),
      journalService.cashFlowReport({
        start_date: INCEPTION_DATE,
        end_date: asOfDate,
      }),
      accountingService.incomeStatement({
        start_date: INCEPTION_DATE,
        end_date: asOfDate,
      }),
    ]);

    const kasNeraca = round2(
      [...sheet.aset.accounts]
        .filter((a) => a.account_code === "1100" || a.account_code === "1150")
        .reduce((s, a) => s + a.balance, 0),
    );
    const kasArusKas = round2(cashFlow.closingBalance);
    const selisihKas = round2(kasArusKas - kasNeraca);

    const labaRugiSebelumPajak = round2(incomeStatement.profit_before_tax);
    const labaBerjalanNeraca = round2(sheet.modal.laba_berjalan);
    const selisihLaba = round2(labaRugiSebelumPajak - labaBerjalanNeraca);

    const TOLERANCE = 1; // toleransi Rp1 untuk pembulatan lintas laporan

    const checks = [
      {
        id: "debit_kredit",
        label: "Debit = Kredit (Neraca Saldo)",
        left_label: "Total Debit",
        left: trial.summary.total_debit,
        right_label: "Total Kredit",
        right: trial.summary.total_credit,
        selisih: trial.summary.selisih_debit_kredit,
        is_valid: trial.summary.is_seimbang,
      },
      {
        id: "aset_kewajiban_modal",
        label: "Aset = Liabilitas + Ekuitas (Neraca)",
        left_label: "Total Aset",
        left: sheet.aset.total,
        right_label: "Kewajiban + Modal",
        right: sheet.total_kewajiban_dan_modal,
        selisih: sheet.selisih,
        is_valid: sheet.is_balanced,
      },
      {
        id: "laba_rugi_laba_berjalan",
        label: "Laba Rugi = Laba Berjalan",
        left_label: "Laba Sebelum Pajak (Laba Rugi)",
        left: labaRugiSebelumPajak,
        right_label: "Laba Berjalan (Neraca)",
        right: labaBerjalanNeraca,
        selisih: selisihLaba,
        is_valid: Math.abs(selisihLaba) < TOLERANCE,
      },
      {
        id: "kas_arus_kas_neraca",
        label: "Kas Arus Kas = Kas Neraca",
        left_label: "Saldo Akhir Kas (Arus Kas)",
        left: kasArusKas,
        right_label: "Saldo Kas+Bank (Neraca)",
        right: kasNeraca,
        selisih: selisihKas,
        is_valid: Math.abs(selisihKas) < TOLERANCE,
      },
      {
        id: "saldo_abnormal",
        label: "Tidak Ada Akun Bersaldo Abnormal",
        left_label: "Jumlah Akun Abnormal",
        left: trial.summary.jumlah_akun_abnormal,
        right_label: "Seharusnya",
        right: 0,
        selisih: trial.summary.jumlah_akun_abnormal,
        is_valid: !trial.summary.has_saldo_abnormal,
        detail: trial.summary.akun_abnormal,
      },
    ];

    return {
      as_of_date: asOfDate,
      checks,
      is_valid: checks.every((c) => c.is_valid),
    };
  },

  // ═════════════════════════════════════════════════════════════════════════
  // BAGIAN 2 — POSTING OTOMATIS per jenis transaksi
  // Dipanggil dari model terkait, DI DALAM transaction DB yang sama (conn
  // dikirim sebagai parameter terakhir). Kalau gagal, error dilempar apa
  // adanya supaya transaction() di model melakukan rollback menyeluruh
  // (lihat komentar di bagian atas file ini).
  // ═════════════════════════════════════════════════════════════════════════

  // 1) Penjualan (checkout kasir) — Dr Kas/Bank + Dr Diskon, Cr Penjualan;
  //    Dr HPP, Cr Persediaan (jika ada harga modal).
  async postSaleJournal(tx, conn) {
    const lines = [];

    if (tx.payment_method === "open_bill") {
      // Open Bill: bagian yang sudah dibayar (DP) masuk Kas, sisanya jadi
      // Piutang Usaha — supaya jurnal tetap balance baik untuk DP sebagian
      // maupun Open Bill penuh (DP = 0).
      const dp = round2(Number(tx.payment_amount) || 0);
      const piutang = round2(Number(tx.final_amount) - dp);
      if (dp > 0) {
        lines.push({
          account_code: ACC.KAS,
          debit: dp,
          description: `Uang muka (DP) penjualan Open Bill ${tx.transaction_code}`,
        });
      }
      if (piutang > 0) {
        lines.push({
          account_code: ACC.PIUTANG,
          debit: piutang,
          description: `Piutang Open Bill ${tx.transaction_code}`,
        });
      }
    } else {
      const kasCode = tx.payment_method === "cash" ? ACC.KAS : ACC.BANK;
      lines.push({
        account_code: kasCode,
        debit: tx.final_amount,
        description: `Penerimaan penjualan ${tx.transaction_code}`,
      });
    }

    lines.push({
      account_code: ACC.PENJUALAN,
      credit: tx.total_amount,
      description: `Penjualan ${tx.transaction_code}`,
    });
    if (Number(tx.discount_amount) > 0) {
      lines.push({
        account_code: ACC.DISKON_PENJUALAN,
        debit: tx.discount_amount,
        description: `Diskon penjualan ${tx.transaction_code}`,
      });
    }
    const totalCost = round2(
      (tx.items || []).reduce(
        (s, i) => s + Number(i.unit_cost || 0) * Number(i.quantity || 0),
        0,
      ),
    );
    if (totalCost > 0) {
      lines.push({
        account_code: ACC.HPP,
        debit: totalCost,
        description: `HPP penjualan ${tx.transaction_code}`,
      });
      lines.push({
        account_code: ACC.PERSEDIAAN,
        credit: totalCost,
        description: `HPP penjualan ${tx.transaction_code}`,
      });
    }
    return journalService.postEntry({
      entryDate: (tx.created_at || toLocalDatetime()).toString().slice(0, 10),
      description: `Penjualan ${tx.transaction_code}`,
      referenceType: "sale",
      referenceId: tx.id,
      referenceCode: tx.transaction_code,
      source: "auto",
      createdBy: tx.cashier_name,
      lines,
      conn,
    });
  },

  // 1a-void) Pembatalan (void) transaksi penjualan — jurnal KOREKSI/PEMBALIK,
  // bukan menghapus jurnal penjualan asli (yang tetap tersimpan untuk jejak
  // audit). Dibangun ulang dari snapshot transaksi (tx.items dsb, sama
  // seperti postSaleJournal), lalu setiap baris debit/kredit-nya DITUKAR
  // (dibalik), sehingga akun-akun yang tadinya bertambah karena penjualan
  // ini kembali ke posisi semula:
  //   - Kas/Bank / Piutang Usaha yang tadi di-debit → sekarang di-kredit
  //   - Penjualan yang tadi di-kredit               → sekarang di-debit
  //   - HPP yang tadi di-debit, Persediaan di-kredit → dibalik juga
  // Dipanggil dari transactionModel.voidTransaction(), di dalam DB
  // transaction yang sama dengan pengembalian stok & pembatalan piutang
  // Open Bill terkait (conn diteruskan) — atomic, sama seperti alur
  // checkout.
  async postVoidSaleJournal(tx, reason, conn) {
    const lines = [];

    if (tx.payment_method === "open_bill") {
      const dp = round2(Number(tx.payment_amount) || 0);
      const piutang = round2(Number(tx.final_amount) - dp);
      if (dp > 0) {
        lines.push({
          account_code: ACC.KAS,
          credit: dp,
          description: `Pembatalan uang muka (DP) penjualan Open Bill ${tx.transaction_code}`,
        });
      }
      if (piutang > 0) {
        lines.push({
          account_code: ACC.PIUTANG,
          credit: piutang,
          description: `Pembatalan piutang Open Bill ${tx.transaction_code}`,
        });
      }
    } else {
      const kasCode = tx.payment_method === "cash" ? ACC.KAS : ACC.BANK;
      lines.push({
        account_code: kasCode,
        credit: tx.final_amount,
        description: `Pembatalan penjualan ${tx.transaction_code}`,
      });
    }

    lines.push({
      account_code: ACC.PENJUALAN,
      debit: tx.total_amount,
      description: `Pembatalan penjualan ${tx.transaction_code}`,
    });
    if (Number(tx.discount_amount) > 0) {
      lines.push({
        account_code: ACC.DISKON_PENJUALAN,
        credit: tx.discount_amount,
        description: `Pembatalan diskon penjualan ${tx.transaction_code}`,
      });
    }
    const totalCost = round2(
      (tx.items || []).reduce(
        (s, i) => s + Number(i.unit_cost || 0) * Number(i.quantity || 0),
        0,
      ),
    );
    if (totalCost > 0) {
      lines.push({
        account_code: ACC.PERSEDIAAN,
        debit: totalCost,
        description: `Pengembalian stok — pembatalan ${tx.transaction_code}`,
      });
      lines.push({
        account_code: ACC.HPP,
        credit: totalCost,
        description: `Pengembalian stok — pembatalan ${tx.transaction_code}`,
      });
    }
    return journalService.postEntry({
      entryDate: toLocalDatetime().slice(0, 10),
      description: `Pembatalan transaksi ${tx.transaction_code}${reason ? ` — ${reason}` : ""}`,
      referenceType: "void",
      referenceId: tx.id,
      referenceCode: tx.transaction_code,
      source: "auto",
      createdBy: tx.voided_by,
      lines,
      conn,
    });
  },

  // 1b) Pembayaran/cicilan Piutang Open Bill — Dr Kas/Bank, Cr Piutang Usaha.
  // Dipanggil dari receivableModel.addPayment(), di dalam DB transaction
  // yang sama dengan insert pembayaran (conn diteruskan) — atomic.
  async postReceivablePaymentJournal(payment, receivable, conn) {
    const kasCode = payment.payment_method === "cash" ? ACC.KAS : ACC.BANK;
    const amount = round2(Number(payment.amount));
    if (amount <= 0) return null;
    const lines = [
      {
        account_code: kasCode,
        debit: amount,
        description: `Pembayaran piutang ${receivable.invoice_code}`,
      },
      {
        account_code: ACC.PIUTANG,
        credit: amount,
        description: `Pembayaran piutang ${receivable.invoice_code}`,
      },
    ];
    return journalService.postEntry({
      entryDate: payment.payment_date || toLocalDatetime().slice(0, 10),
      description: `Pembayaran piutang ${receivable.invoice_code} — ${receivable.customer_name}`,
      referenceType: "receivable_payment",
      referenceId: receivable.id,
      referenceCode: receivable.invoice_code,
      source: "auto",
      createdBy: payment.recorded_by,
      lines,
      conn,
    });
  },

  async postReceivableCreationJournal(receivable, conn) {
    const amount = round2(Number(receivable.amount));
    if (amount <= 0) return null;
    const lines = [
      {
        account_code: ACC.PIUTANG,
        debit: amount,
        description: `Pencatatan piutang manual ${receivable.invoice_code}`,
      },
      {
        account_code: ACC.SALDO_AWAL,
        credit: amount,
        description: `Pencatatan piutang manual ${receivable.invoice_code}`,
      },
    ];
    return journalService.postEntry({
      entryDate: receivable.invoice_date,
      description: `Piutang manual ${receivable.invoice_code} — ${receivable.customer_name}`,
      referenceType: "receivable_creation",
      referenceId: receivable.id,
      referenceCode: receivable.invoice_code,
      source: "auto",
      createdBy: receivable.recorded_by,
      lines,
      conn,
    });
  },

  // 2) Pembelian stok — Dr Persediaan, lalu:
  //    - tunai  → Cr Kas (dibayar langsung, tidak membuat hutang)
  //    - kredit → Cr Utang Usaha (faktur hutang dibuat di payables,
  //               lihat purchaseModel.createPurchase)
  async postPurchaseJournal(purchase, conn) {
    const isCredit = purchase.payment_method === "kredit";
    return journalService.postEntry({
      entryDate: purchase.purchase_date,
      description: `Pembelian stok ${purchase.purchase_code}${isCredit ? " (kredit)" : ""}`,
      referenceType: "purchase",
      referenceId: purchase.id,
      referenceCode: purchase.purchase_code,
      source: "auto",
      createdBy: purchase.recorded_by,
      lines: [
        {
          account_code: ACC.PERSEDIAAN,
          debit: purchase.total_cost,
          description: `Pembelian ${purchase.purchase_code}`,
        },
        {
          account_code: isCredit ? ACC.UTANG_USAHA : ACC.KAS,
          credit: purchase.total_cost,
          description: isCredit
            ? `Hutang pembelian ${purchase.purchase_code}`
            : `Pembelian ${purchase.purchase_code}`,
        },
      ],
      conn,
    });
  },

  // 2b) Pembayaran/cicilan Hutang pembelian — Dr Utang Usaha, Cr Kas/Bank.
  // Dipanggil dari payableService.recordPayment() setelah pembayaran
  // tersimpan (best-effort, sama seperti postReceivablePaymentJournal).
  async postPayablePaymentJournal(payment, payable, conn) {
    const kasCode = payment.payment_method === "cash" ? ACC.KAS : ACC.BANK;
    const amount = round2(Number(payment.amount));
    if (amount <= 0) return null;
    const lines = [
      {
        account_code: ACC.UTANG_USAHA,
        debit: amount,
        description: `Pembayaran hutang ${payable.invoice_code}`,
      },
      {
        account_code: kasCode,
        credit: amount,
        description: `Pembayaran hutang ${payable.invoice_code}`,
      },
    ];
    return journalService.postEntry({
      entryDate: payment.payment_date || toLocalDatetime().slice(0, 10),
      description: `Pembayaran hutang ${payable.invoice_code} — ${payable.supplier_name}`,
      referenceType: "payable_payment",
      referenceId: payable.id,
      referenceCode: payable.invoice_code,
      source: "auto",
      createdBy: payment.recorded_by,
      lines,
      conn,
    });
  },

  // 2b) Hutang manual (supplier) TANPA purchase_id — mengakui kewajiban yang
  // sudah ada (bukan transaksi baru), jadi lawan akunnya BUKAN Persediaan
  // (barangnya belum tentu benar-benar bertambah lewat entri ini) melainkan
  // "Saldo Awal / Penyesuaian" (3300). Hutang yang berasal dari modul
  // Pembelian (ada purchase_id) TIDAK lewat sini — jurnalnya sudah dipasang
  // oleh postPurchaseJournal() saat pembelian dibuat, supaya tidak dobel.
  async postPayableCreationJournal(payable, conn) {
    const amount = round2(Number(payable.amount));
    if (amount <= 0) return null;
    const lines = [
      {
        account_code: ACC.SALDO_AWAL,
        debit: amount,
        description: `Pencatatan hutang manual ${payable.invoice_code}`,
      },
      {
        account_code: ACC.UTANG_USAHA,
        credit: amount,
        description: `Pencatatan hutang manual ${payable.invoice_code}`,
      },
    ];
    return journalService.postEntry({
      entryDate: payable.invoice_date,
      description: `Hutang manual ${payable.invoice_code} — ${payable.supplier_name}`,
      referenceType: "payable_creation",
      referenceId: payable.id,
      referenceCode: payable.invoice_code,
      source: "auto",
      createdBy: payable.recorded_by,
      lines,
      conn,
    });
  },

  async postExpenseJournal(expense, conn) {
    const accountCode = EXPENSE_CATEGORY_ACCOUNT[expense.category] || "5280";
    const accrualCode = EXPENSE_ACCRUAL_ACCOUNT[expense.category];
    const amount = round2(Number(expense.amount) || 0);

    const debitLines = [];
    let remaining = amount;

    if (accrualCode) {
      const accrualAccount = await journalModel.findAccountByCode(accrualCode);
      if (accrualAccount) {
        const bal = await journalModel.accountBalance(accrualAccount.id, conn);
        // Akun Utang = kewajiban, saldo normal kredit → outstanding = kredit − debit.
        const outstanding = round2(
          Number(bal.total_credit || 0) - Number(bal.total_debit || 0),
        );
        if (outstanding > 0.01) {
          const settle = round2(Math.min(outstanding, remaining));
          debitLines.push({
            account_code: accrualCode,
            debit: settle,
            description: `Pelunasan ${accrualAccount.account_name} (akrual periode sebelumnya)`,
          });
          remaining = round2(remaining - settle);
        }
      }
    }
    if (remaining > 0.01) {
      debitLines.push({
        account_code: accountCode,
        debit: remaining,
        description: expense.description || "Biaya operasional",
      });
    }

    return journalService.postEntry({
      entryDate: expense.expense_date,
      description: expense.description || "Biaya operasional",
      referenceType: "expense",
      referenceId: expense.id,
      referenceCode: `EXP-${expense.id}`,
      source: "auto",
      createdBy: expense.recorded_by,
      lines: [
        ...debitLines,
        {
          account_code: ACC.KAS,
          credit: amount,
          description: expense.description || "Biaya operasional",
        },
      ],
      conn,
    });
  },

  async postVoidExpenseJournal(expense, conn) {
    const originalEntry = await journalModel.findLatestEntryByReference(
      "expense",
      expense.id,
    );

    let lines;
    let reversalOfId;
    if (originalEntry) {
      const originalLines = await journalModel.findLinesByEntryId(
        originalEntry.id,
      );
      lines = originalLines.map((l) => ({
        account_id: l.account_id,
        debit: Number(l.credit) || 0,
        credit: Number(l.debit) || 0,
        description: l.description || "",
      }));
      reversalOfId = originalEntry.id;
    } else {
      // Fallback untuk data historis dari sebelum fix ini (entry asal
      // tidak ketemu by reference) — rekonstruksi seperti perilaku lama.
      const accountCode = EXPENSE_CATEGORY_ACCOUNT[expense.category] || "5280";
      lines = [
        {
          account_code: ACC.KAS,
          debit: expense.amount,
          description: expense.description || "Biaya operasional",
        },
        {
          account_code: accountCode,
          credit: expense.amount,
          description: expense.description || "Biaya operasional",
        },
      ];
    }

    return journalService.postEntry({
      entryDate: expense.expense_date,
      description: `Pembatalan/koreksi biaya — ${expense.description || "Biaya operasional"}`,
      referenceType: "expense_void",
      referenceId: expense.id,
      referenceCode: `EXP-${expense.id}`,
      source: "auto",
      createdBy: expense.recorded_by,
      lines,
      reversalOfId,
      conn,
    });
  },

  // 4) Pergerakan kas kecil (cash in/out) di luar penjualan.
  async postCashMovementJournal(movement, shiftCode, conn) {
    const entryDate = toLocalDatetime().slice(0, 10);
    if (movement.type === "out") {
      const accountCode =
        CASH_OUT_CATEGORY_ACCOUNT[movement.category] || ACC.BEBAN_KAS_KECIL;
      return journalService.postEntry({
        entryDate,
        description:
          movement.description || `Kas keluar (${movement.category})`,
        referenceType: "cash_movement",
        referenceId: movement.id,
        referenceCode: shiftCode,
        source: "auto",
        createdBy: movement.created_by,
        lines: [
          {
            account_code: accountCode,
            debit: movement.amount,
            description: movement.description || movement.category,
          },
          {
            account_code: ACC.KAS,
            credit: movement.amount,
            description: movement.description || movement.category,
          },
        ],
        conn,
      });
    }
    const accountCode =
      CASH_IN_CATEGORY_ACCOUNT[movement.category] || ACC.PENDAPATAN_LAIN;
    return journalService.postEntry({
      entryDate,
      description: movement.description || `Kas masuk (${movement.category})`,
      referenceType: "cash_movement",
      referenceId: movement.id,
      referenceCode: shiftCode,
      source: "auto",
      createdBy: movement.created_by,
      lines: [
        {
          account_code: ACC.KAS,
          debit: movement.amount,
          description: movement.description || movement.category,
        },
        {
          account_code: accountCode,
          credit: movement.amount,
          description: movement.description || movement.category,
        },
      ],
      conn,
    });
  },

  // 4b) Jurnal pembalik cash movement — dipanggil saat cash movement
  // (kas masuk/keluar) dihapus, supaya General Ledger ikut menyesuaikan.
  // Sebelumnya penghapusan cash_movements tidak diikuti pembalikan jurnal
  // sama sekali: baris cash_movements hilang tapi jurnal Dr Beban/Cr Kas
  // (atau sebaliknya) tetap ada, sehingga saldo kas di GL jadi salah.
  // Baris debit/kredit di sini ditukar apa adanya dari postCashMovementJournal
  // (pola sama seperti reverseEntry untuk jurnal manual/adjustment).
  async postVoidCashMovementJournal(movement, shiftCode, conn) {
    const entryDate = toLocalDatetime().slice(0, 10);
    const isOut = movement.type === "out";
    const accountCode = isOut
      ? CASH_OUT_CATEGORY_ACCOUNT[movement.category] || ACC.BEBAN_KAS_KECIL
      : CASH_IN_CATEGORY_ACCOUNT[movement.category] || ACC.PENDAPATAN_LAIN;
    const label = movement.description || movement.category;

    return journalService.postEntry({
      entryDate,
      description: `Pembatalan ${isOut ? "kas keluar" : "kas masuk"} (${label})`,
      referenceType: "cash_movement_void",
      referenceId: movement.id,
      referenceCode: shiftCode,
      source: "auto",
      createdBy: movement.created_by,
      lines: isOut
        ? [
            {
              account_code: ACC.KAS,
              debit: movement.amount,
              description: label,
            },
            {
              account_code: accountCode,
              credit: movement.amount,
              description: label,
            },
          ]
        : [
            {
              account_code: accountCode,
              debit: movement.amount,
              description: label,
            },
            {
              account_code: ACC.KAS,
              credit: movement.amount,
              description: label,
            },
          ],
      conn,
    });
  },

  // 5) Penyesuaian selisih tutup kas (fisik vs sistem).
  async postCashShiftCloseJournal(shift, conn) {
    const diff = round2(Number(shift.difference));
    if (diff === 0) return null; // tidak ada selisih, tidak perlu jurnal
    const entryDate = toLocalDatetime().slice(0, 10);
    const lines =
      diff < 0
        ? [
            {
              account_code: ACC.SELISIH_KAS,
              debit: Math.abs(diff),
              description: `Selisih kurang tutup kas ${shift.shift_code}`,
            },
            {
              account_code: ACC.KAS,
              credit: Math.abs(diff),
              description: `Selisih kurang tutup kas ${shift.shift_code}`,
            },
          ]
        : [
            {
              account_code: ACC.KAS,
              debit: diff,
              description: `Selisih lebih tutup kas ${shift.shift_code}`,
            },
            {
              account_code: ACC.PENDAPATAN_LAIN,
              credit: diff,
              description: `Selisih lebih tutup kas ${shift.shift_code}`,
            },
          ];
    return journalService.postEntry({
      entryDate,
      description: `Penyesuaian selisih tutup kas ${shift.shift_code}`,
      referenceType: "cash_shift_close",
      referenceId: shift.id,
      referenceCode: shift.shift_code,
      source: "auto",
      createdBy: shift.closed_by,
      lines,
      conn,
    });
  },

  // 6b) Modal Usaha — setoran (termasuk Modal Awal) & penarikan (prive).
  //     Setoran : Dr Kas/Bank,       Cr Modal Pemilik (3100)
  //     Penarikan: Dr Prive (3200),  Cr Kas/Bank
  async postCapitalJournal(tx, conn) {
    const kasCode = tx.target_account === "bank" ? ACC.BANK : ACC.KAS;
    const label =
      tx.type === "setoran"
        ? tx.is_initial
          ? `Setoran modal awal ${tx.transaction_code}`
          : `Setoran modal tambahan ${tx.transaction_code}`
        : `Penarikan modal (prive) ${tx.transaction_code}`;

    const lines =
      tx.type === "setoran"
        ? [
            {
              account_code: kasCode,
              debit: tx.amount,
              description: label,
            },
            {
              account_code: ACC.MODAL_PEMILIK,
              credit: tx.amount,
              description: label,
            },
          ]
        : [
            {
              account_code: ACC.PRIVE,
              debit: tx.amount,
              description: label,
            },
            {
              account_code: kasCode,
              credit: tx.amount,
              description: label,
            },
          ];

    return journalService.postEntry({
      entryDate: tx.transaction_date,
      description: tx.description || label,
      referenceType: "capital",
      referenceId: tx.id,
      referenceCode: tx.transaction_code,
      source: "auto",
      createdBy: tx.recorded_by,
      lines,
      conn,
    });
  },

  // 5b) Pencairan pinjaman bank / utang lainnya diterima — Dr Kas/Bank,
  // Cr Utang Bank atau Utang Lainnya (tergantung `type`). Ini yang membuat
  // pinjaman eksplisit menaikkan KEWAJIBAN, bukan Modal — beda dari
  // postCapitalJournal (setoran modal asli pemilik) di atas.
  async postOtherPayableJournal(op, conn) {
    const amount = round2(Number(op.principal_amount));
    if (amount <= 0) return null;
    const kasCode = op.target_account === "kas" ? ACC.KAS : ACC.BANK;
    const liabilityCode =
      OTHER_PAYABLE_TYPE_ACCOUNT[op.type] || ACC.UTANG_LAINNYA;
    const label = `Pencairan ${op.type === "pinjaman_bank" ? "pinjaman bank" : "utang lainnya"} ${op.code} — ${op.creditor_name}`;
    const lines = [
      { account_code: kasCode, debit: amount, description: label },
      { account_code: liabilityCode, credit: amount, description: label },
    ];
    return journalService.postEntry({
      entryDate: op.disbursement_date,
      description: label,
      referenceType: "other_payable",
      referenceId: op.id,
      referenceCode: op.code,
      source: "auto",
      createdBy: op.recorded_by,
      lines,
      conn,
    });
  },

  // 5c) Bayar cicilan pinjaman — split pokok (turunkan Utang) vs bunga
  // (Beban Bunga Pinjaman), Cr Kas/Bank sejumlah pokok+bunga.
  async postOtherPayablePaymentJournal(payment, op, conn) {
    const principal = round2(Number(payment.principal_amount));
    const interest = round2(Number(payment.interest_amount));
    const total = round2(principal + interest);
    if (total <= 0) return null;
    const kasCode = payment.payment_method === "cash" ? ACC.KAS : ACC.BANK;
    const liabilityCode =
      OTHER_PAYABLE_TYPE_ACCOUNT[op.type] || ACC.UTANG_LAINNYA;
    const label = `Cicilan ${op.code} — ${op.creditor_name}`;
    const lines = [];
    if (principal > 0) {
      lines.push({
        account_code: liabilityCode,
        debit: principal,
        description: label,
      });
    }
    if (interest > 0) {
      lines.push({
        account_code: ACC.BEBAN_BUNGA_PINJAMAN,
        debit: interest,
        description: label,
      });
    }
    lines.push({ account_code: kasCode, credit: total, description: label });
    return journalService.postEntry({
      entryDate: payment.payment_date,
      description: label,
      referenceType: "other_payable_payment",
      referenceId: op.id,
      referenceCode: op.code,
      source: "auto",
      createdBy: payment.recorded_by,
      lines,
      conn,
    });
  },

  // 6) Penyesuaian stock opname (selisih nilai stok fisik vs sistem).
  async postStockOpnameJournal(session, conn) {
    const diffValue = round2(Number(session.total_difference_value));
    if (diffValue === 0) return null;
    const lines =
      diffValue < 0
        ? [
            {
              account_code: ACC.SELISIH_STOK,
              debit: Math.abs(diffValue),
              description: `Selisih kurang stok opname ${session.opname_code}`,
            },
            {
              account_code: ACC.PERSEDIAAN,
              credit: Math.abs(diffValue),
              description: `Selisih kurang stok opname ${session.opname_code}`,
            },
          ]
        : [
            {
              account_code: ACC.PERSEDIAAN,
              debit: diffValue,
              description: `Selisih lebih stok opname ${session.opname_code}`,
            },
            {
              account_code: ACC.PENDAPATAN_LAIN,
              credit: diffValue,
              description: `Selisih lebih stok opname ${session.opname_code}`,
            },
          ];
    return journalService.postEntry({
      entryDate: session.opname_date,
      description: `Penyesuaian stock opname ${session.opname_code}`,
      referenceType: "stock_opname",
      referenceId: session.id,
      referenceCode: session.opname_code,
      source: "auto",
      createdBy: session.recorded_by,
      lines,
      conn,
    });
  },
};

// ACC diekspor juga (bukan cuma journalService) supaya service lain (mis.
// purchaseService, untuk validasi saldo Kas/Bank Kantor sebelum pembelian
// tunai) bisa merujuk kode akun sistem yang sama, tanpa menduplikasi/
// hardcode ulang "1100"/"1150" di tempat lain.
module.exports = Object.assign(journalService, { ACC });
