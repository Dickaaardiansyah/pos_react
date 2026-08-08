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
const { toLocalDatetime } = require("./transactionService");

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

  const cashSalesRow = await cashRegisterModel.sumCashSales(
    shift.opened_at,
    shift.closed_at,
  );
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

  async getActiveShift() {
    const shift = await cashRegisterModel.findActiveShift();
    if (!shift) return null;
    return buildShiftSummary(shift);
  },

  async openShift(payload) {
    const existing = await cashRegisterModel.findActiveShift();
    if (existing) {
      throw new ValidationError(
        "Masih ada sesi kas yang terbuka. Tutup kas terlebih dahulu sebelum membuka sesi baru",
      );
    }

    const { opening_balance, opening_notes, opened_by } = payload;
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

    const result = await cashRegisterModel.createShift({
      shiftCode: generateShiftCode(),
      openingBalance: Number(opening_balance),
      openingNotes: opening_notes,
      openedBy: opened_by,
      occurredAt: toLocalDatetime(),
    });
    const shift = await cashRegisterModel.findShiftById(result.insertId);
    return buildShiftSummary(shift);
  },

  async createMovement(payload) {
    const shift = await cashRegisterModel.findActiveShift();
    if (!shift) {
      throw new ValidationError(
        "Tidak ada sesi kas yang sedang terbuka. Buka kas terlebih dahulu",
      );
    }

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
    await cashRegisterModel.createMovement({
      shiftId: shift.id,
      shiftCode: shift.shift_code,
      type,
      category,
      amount: Number(amount),
      description: description,
      createdBy: payload.created_by,
      occurredAt: toLocalDatetime(),
    });

    const updated = await cashRegisterModel.findShiftById(shift.id);
    return buildShiftSummary(updated);
  },

  async deleteMovement(id) {
    const movement = await cashRegisterModel.findMovementById(id);
    if (!movement)
      throw new NotFoundError("Data pergerakan kas tidak ditemukan");

    const shift = await cashRegisterModel.findShiftById(movement.shift_id);
    if (!shift || shift.status !== "open") {
      throw new ValidationError(
        "Hanya pergerakan kas pada sesi yang masih terbuka yang dapat dihapus",
      );
    }

    await cashRegisterModel.deleteMovement(id);
    const updated = await cashRegisterModel.findShiftById(shift.id);
    return buildShiftSummary(updated);
  },

  async closeShift(id, payload) {
    const shift = await cashRegisterModel.findShiftById(id);
    if (!shift) throw new NotFoundError("Sesi kas tidak ditemukan");
    if (shift.status !== "open") {
      throw new ValidationError("Sesi kas ini sudah ditutup sebelumnya");
    }

    const { closing_balance_physical, closing_notes, closed_by } = payload;
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
    const closed = await cashRegisterModel.closeShift(id, {
      closingBalanceSystem: summary.expected_balance,
      closingBalancePhysical: physical,
      difference,
      totalCashSales: summary.total_cash_sales,
      totalCashIn: summary.total_cash_in,
      totalCashOut: summary.total_cash_out,
      closingNotes: closing_notes,
      closedBy: closed_by,
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
