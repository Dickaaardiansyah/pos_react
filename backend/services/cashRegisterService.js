// services/cashRegisterService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — modul Kas Kecil (Cash Register):
//   • Buka/tutup sesi kas per shift/hari
//   • Catat pengeluaran & pemasukan kas insidental (Cash Out / Cash In)
//   • Hitung saldo kas seharusnya menurut sistem & selisihnya terhadap hasil
//     hitung fisik saat tutup kas
//
// Rumus saldo seharusnya saat tutup kas:
//   saldo_sistem = modal_awal + total_penjualan_tunai + total_kas_masuk
//                  - total_kas_keluar
//   selisih      = kas_fisik - saldo_sistem
//
// "total_penjualan_tunai" mencakup transaksi tunai penuh DAN DP tunai
// transaksi Open Bill (lihat cashRegisterModel.sumCashSales) — keduanya
// sama-sama di-debit ke akun Kas (1100) oleh journalService.postSaleJournal.
//
// CATATAN SKOP: modul ini merepresentasikan laci kasir harian, BUKAN saldo
// akun Kas (COA 1100) di pembukuan secara keseluruhan. Transaksi lain yang
// juga menyentuh akun Kas di jurnal — pembayaran piutang/utang tunai,
// pembelian tunai, setoran/prive modal tunai, beban operasional — sengaja
// tidak dihitung di sini. Kalau operasional toko juga memakai laci yang
// sama untuk transaksi-transaksi itu, saldo "seharusnya" di modul ini akan
// berbeda dari saldo akun Kas di Neraca Saldo — itu memang konsekuensi dari
// keputusan desain ini, bukan bug.
// ─────────────────────────────────────────────────────────────────────────────
const cashRegisterModel = require("../models/cashRegisterModel");
const { ValidationError, NotFoundError } = require("./productService");
const { ForbiddenError } = require("../middleware/auth");
const { toLocalDatetime, defaultDateRange } = require("./transactionService");

// FIX KEAMANAN (review dosen — sesi kas bersifat global, bukan per kasir):
// findActiveShift() memang SENGAJA tetap mengambil SATU sesi kas 'open'
// secara global (bukan per-user) — POS ini didesain satu terminal/laci kas
// fisik pada satu waktu, jadi wajar hanya ada satu sesi aktif. Yang TIDAK
// boleh global adalah OTORISASI di atasnya: sebelumnya siapapun yang login
// bisa cash in/out bahkan menutup sesi yang dibuka kasir lain, karena tidak
// ada pengecekan pemilik sama sekali. assertOwnsShift() menutup celah itu —
// dipanggil di setiap mutasi (createMovement, deleteMovement, closeShift)
// sebelum aksi dijalankan.
//
// Shift lama (dibuka sebelum migration cash_shift_ownership.sql, sehingga
// opened_by_user_id-nya NULL) sengaja tetap diizinkan siapapun menutupnya —
// supaya data lama tidak "terkunci" tanpa pemilik yang bisa menutupnya.
function assertOwnsShift(shift, user, action) {
  if (shift.opened_by_user_id != null && shift.opened_by_user_id !== user.id) {
    throw new ForbiddenError(
      `Sesi kas ini sedang dipegang kasir lain (${shift.opened_by}). Anda tidak bisa ${action} sesi ini.`,
    );
  }
}

const CASH_OUT_CATEGORIES = [
  { id: "sedekah_donasi", label: "Sedekah / Donasi" },
  { id: "transportasi", label: "Transportasi / Bensin" },
  { id: "konsumsi", label: "Konsumsi / Minum Karyawan" },
  { id: "perlengkapan", label: "Perlengkapan Kecil" },
  { id: "kembalian_kurang", label: "Kembalian Kurang / Pembulatan" },
  { id: "lainnya", label: "Lainnya" },
];

const CASH_IN_CATEGORIES = [
  { id: "setoran_modal", label: "Setoran Modal Tambahan" },
  { id: "pengembalian", label: "Pengembalian Pinjaman Kas" },
  { id: "lainnya", label: "Lainnya" },
];

function generateShiftCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `KAS${date}${rand}`;
}

const CASH_OUT_LABELS = Object.fromEntries(
  CASH_OUT_CATEGORIES.map((c) => [c.id, c.label]),
);
const CASH_IN_LABELS = Object.fromEntries(
  CASH_IN_CATEGORIES.map((c) => [c.id, c.label]),
);

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Melengkapi satu baris cash_shifts dengan ringkasan berjalan: total kas
// masuk/keluar, total penjualan tunai, dan estimasi saldo seharusnya saat ini
// (berguna baik untuk sesi yang masih terbuka maupun sudah ditutup).
async function buildShiftSummary(shift) {
  const movements = await cashRegisterModel.findMovementsByShift(shift.id);
  const totalCashIn = round2(
    movements
      .filter((m) => m.type === "in")
      .reduce((s, m) => s + Number(m.amount), 0),
  );
  const totalCashOut = round2(
    movements
      .filter((m) => m.type === "out")
      .reduce((s, m) => s + Number(m.amount), 0),
  );

  const cashSalesRow = await cashRegisterModel.sumCashSales(shift.id);
  const totalCashSales = round2(cashSalesRow?.total_cash_sales || 0);

  const expectedBalance = round2(
    Number(shift.opening_balance) + totalCashSales + totalCashIn - totalCashOut,
  );

  return {
    ...shift,
    movements,
    total_cash_sales: totalCashSales,
    total_cash_in: totalCashIn,
    total_cash_out: totalCashOut,
    expected_balance: expectedBalance,
  };
}

const cashRegisterService = {
  cashOutCategories() {
    return CASH_OUT_CATEGORIES;
  },

  cashInCategories() {
    return CASH_IN_CATEGORIES;
  },

  // ─── Laporan Kas Masuk / Kas Keluar ──────────────────────────────────────
  // Rekap lintas shift untuk suatu rentang tanggal — beda dari getShiftDetail
  // (satu sesi) & getHistory (ringkasan per sesi). Kas Masuk digabung dari 3
  // sumber: modal awal tiap sesi yang dibuka, penjualan tunai (direkap per
  // hari), dan cash_movements type='in' (setoran modal, pengembalian, dll).
  // Kas Keluar murni dari cash_movements type='out'.
  async report({ start_date, end_date }) {
    const { startDate, endDate } = defaultDateRange(start_date, end_date);
    const [movements, shiftOpenings, cashSalesByDay] = await Promise.all([
      cashRegisterModel.reportMovements(startDate, endDate),
      cashRegisterModel.reportShiftOpenings(startDate, endDate),
      cashRegisterModel.reportCashSalesByDay(startDate, endDate),
    ]);

    const cashIn = [];
    const cashOut = [];

    for (const s of shiftOpenings) {
      cashIn.push({
        waktu: s.opened_at,
        keterangan:
          s.opening_notes?.trim() || `Modal awal buka kas (${s.shift_code})`,
        kategori: "Kas Awal",
        nominal: Number(s.opening_balance) || 0,
        user: s.opened_by,
        shift_code: s.shift_code,
      });
    }

    for (const d of cashSalesByDay) {
      cashIn.push({
        waktu: d.sale_date,
        keterangan: "Rekap penjualan tunai harian",
        kategori: "Penjualan Cash",
        nominal: Number(d.total_cash_sales) || 0,
        user: "-",
        shift_code: null,
      });
    }

    for (const m of movements) {
      const row = {
        waktu: m.created_at,
        keterangan:
          m.description?.trim() ||
          (m.type === "in"
            ? CASH_IN_LABELS[m.category]
            : CASH_OUT_LABELS[m.category]) ||
          "-",
        kategori:
          m.type === "in"
            ? CASH_IN_LABELS[m.category] || m.category
            : CASH_OUT_LABELS[m.category] || m.category,
        nominal: Number(m.amount) || 0,
        user: m.created_by,
        shift_code: m.shift_code,
      };
      if (m.type === "in") cashIn.push(row);
      else cashOut.push(row);
    }

    cashIn.sort((a, b) => new Date(a.waktu) - new Date(b.waktu));
    cashOut.sort((a, b) => new Date(a.waktu) - new Date(b.waktu));

    const totalKasAwal = round2(
      shiftOpenings.reduce((sum, s) => sum + Number(s.opening_balance || 0), 0),
    );
    const totalPenjualanCash = round2(
      cashSalesByDay.reduce(
        (sum, d) => sum + Number(d.total_cash_sales || 0),
        0,
      ),
    );
    const totalKasMasukLain = round2(
      movements
        .filter((m) => m.type === "in")
        .reduce((sum, m) => sum + Number(m.amount || 0), 0),
    );
    const totalKasKeluar = round2(
      movements
        .filter((m) => m.type === "out")
        .reduce((sum, m) => sum + Number(m.amount || 0), 0),
    );
    const totalKasMasuk = round2(
      totalKasAwal + totalPenjualanCash + totalKasMasukLain,
    );

    return {
      startDate,
      endDate,
      cashIn,
      cashOut,
      summary: {
        total_kas_awal: totalKasAwal,
        total_penjualan_cash: totalPenjualanCash,
        total_kas_masuk_lain: totalKasMasukLain,
        total_kas_masuk: totalKasMasuk,
        total_kas_keluar: totalKasKeluar,
        selisih: round2(totalKasMasuk - totalKasKeluar),
      },
    };
  },

  async getActiveShift(user) {
    const shift = await cashRegisterModel.findActiveShift();
    if (!shift) return null;
    const summary = await buildShiftSummary(shift);
    // is_owner: dipakai frontend untuk membedakan "kas yang sedang saya
    // pegang" vs "kas sedang dipegang kasir lain" — supaya UI tidak
    // menampilkan tombol cash in/out/tutup kas untuk sesi yang bukan
    // miliknya (sekalipun backend tetap menegakkan ini di tiap mutasi).
    const isOwner =
      shift.opened_by_user_id == null || shift.opened_by_user_id === user?.id;
    return { ...summary, is_owner: isOwner };
  },

  async openShift(payload, user) {
    const existing = await cashRegisterModel.findActiveShift();
    if (existing) {
      throw new ValidationError(
        "Masih ada sesi kas yang terbuka. Tutup kas terlebih dahulu sebelum membuka sesi baru",
      );
    }

    const { opening_balance, opening_notes } = payload;
    if (
      opening_balance === undefined ||
      opening_balance === null ||
      opening_balance === ""
    ) {
      throw new ValidationError("Modal awal kas wajib diisi");
    }
    if (Number(opening_balance) < 0) {
      throw new ValidationError("Modal awal kas tidak boleh negatif");
    }

    // FIX KEAMANAN: nama & id pembuka sesi SELALU dari identitas login
    // (req.user, hasil verifikasi JWT), bukan dari payload.opened_by yang
    // dulu dikirim mentah-mentah oleh klien — klien tidak boleh bisa
    // mengatasnamakan kasir lain saat membuka sesi kas.
    const result = await cashRegisterModel.createShift({
      shiftCode: generateShiftCode(),
      openingBalance: Number(opening_balance),
      openingNotes: opening_notes,
      openedBy: user.name,
      openedByUserId: user.id,
      occurredAt: toLocalDatetime(),
    });
    const shift = await cashRegisterModel.findShiftById(result.insertId);
    return buildShiftSummary(shift);
  },

  async createMovement(payload, user) {
    const shift = await cashRegisterModel.findActiveShift();
    if (!shift) {
      throw new ValidationError(
        "Tidak ada sesi kas yang sedang terbuka. Buka kas terlebih dahulu",
      );
    }
    // FIX KEAMANAN: dulu siapapun yang login bisa cash in/out ke sesi kas
    // aktif walau dibuka kasir lain (findActiveShift bersifat global, tidak
    // ada pengecekan pemilik). Sekarang diverifikasi terhadap
    // opened_by_user_id sebelum pergerakan kas dicatat.
    assertOwnsShift(shift, user, "mencatat kas masuk/keluar pada");

    const { type, category, amount, description } = payload;
    if (!["in", "out"].includes(type)) {
      throw new ValidationError("Jenis pergerakan kas tidak valid");
    }
    if (!category) {
      throw new ValidationError("Kategori wajib dipilih");
    }
    if (!amount || Number(amount) <= 0) {
      throw new ValidationError("Jumlah harus lebih dari 0");
    }

    // Insert pergerakan kas + posting jurnal terjadi dalam SATU DB
    // transaction di cashRegisterModel.createMovement — kalau jurnal gagal,
    // pergerakan kas ini ikut rollback (tidak lagi best-effort).
    // created_by juga dari identitas login, bukan payload.created_by.
    await cashRegisterModel.createMovement({
      shiftId: shift.id,
      shiftCode: shift.shift_code,
      type,
      category,
      amount: Number(amount),
      description: description,
      createdBy: user.name,
      occurredAt: toLocalDatetime(),
    });

    const updated = await cashRegisterModel.findShiftById(shift.id);
    return buildShiftSummary(updated);
  },

  async deleteMovement(id, user) {
    const movement = await cashRegisterModel.findMovementById(id);
    if (!movement)
      throw new NotFoundError("Data pergerakan kas tidak ditemukan");

    const shift = await cashRegisterModel.findShiftById(movement.shift_id);
    if (!shift || shift.status !== "open") {
      throw new ValidationError(
        "Hanya pergerakan kas pada sesi yang masih terbuka yang dapat dihapus",
      );
    }
    // FIX KEAMANAN: hanya kasir pemilik sesi yang boleh menghapus catatan
    // kas pada sesi itu.
    assertOwnsShift(shift, user, "menghapus catatan kas pada");

    // Hapus pergerakan kas + posting jurnal pembalik terjadi dalam SATU DB
    // transaction di cashRegisterModel.deleteMovement — supaya General
    // Ledger ikut menyesuaikan, bukan cuma baris cash_movements yang hilang
    // (lihat catatan revisi dosen: hapus cash movement sebelumnya tidak
    // membalik jurnal, sehingga GL tetap mengurangi/menambah kas padahal
    // transaksinya sudah dibatalkan).
    await cashRegisterModel.deleteMovement(id, shift.shift_code);
    const updated = await cashRegisterModel.findShiftById(shift.id);
    return buildShiftSummary(updated);
  },

  async closeShift(id, payload, user) {
    const shift = await cashRegisterModel.findShiftById(id);
    if (!shift) throw new NotFoundError("Sesi kas tidak ditemukan");
    if (shift.status !== "open") {
      throw new ValidationError("Sesi kas ini sudah ditutup sebelumnya");
    }
    // FIX KEAMANAN (inti temuan review): dulu kasir B bisa menutup sesi kas
    // yang dibuka kasir A, karena tidak ada verifikasi pemilik sama sekali.
    assertOwnsShift(shift, user, "menutup");

    const { closing_balance_physical, closing_notes } = payload;
    if (
      closing_balance_physical === undefined ||
      closing_balance_physical === null ||
      closing_balance_physical === ""
    ) {
      throw new ValidationError("Jumlah kas fisik hasil hitung wajib diisi");
    }
    if (Number(closing_balance_physical) < 0) {
      throw new ValidationError("Jumlah kas fisik tidak boleh negatif");
    }

    const summary = await buildShiftSummary(shift);
    const physical = round2(closing_balance_physical);
    const difference = round2(physical - summary.expected_balance);

    // Tutup sesi + posting jurnal selisih (jika ada) terjadi dalam SATU DB
    // transaction di cashRegisterModel.closeShift — kalau jurnal gagal,
    // penutupan sesi ini ikut rollback (tidak lagi best-effort).
    // closed_by juga dari identitas login, bukan payload.closed_by.
    const closed = await cashRegisterModel.closeShift(id, {
      closingBalanceSystem: summary.expected_balance,
      closingBalancePhysical: physical,
      difference,
      totalCashSales: summary.total_cash_sales,
      totalCashIn: summary.total_cash_in,
      totalCashOut: summary.total_cash_out,
      closingNotes: closing_notes,
      closedBy: user.name,
      closedByUserId: user.id,
      occurredAt: toLocalDatetime(),
    });

    return buildShiftSummary(closed);
  },

  async history({ start_date, end_date, page = 1, limit = 20 }) {
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const { total, rows } = await cashRegisterModel.findShiftHistory({
      startDate: start_date,
      endDate: end_date,
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit,
    });
    return { data: rows, total, page: parsedPage, limit: parsedLimit };
  },

  async getShiftDetail(id) {
    const shift = await cashRegisterModel.findShiftById(id);
    if (!shift) throw new NotFoundError("Sesi kas tidak ditemukan");
    const movements = await cashRegisterModel.findMovementsByShift(id);
    return { ...shift, movements };
  },
};

module.exports = cashRegisterService;
