// services/capitalService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — modul Modal Usaha (Owner's Capital):
//   • Input Modal Awal usaha (sekali, jadi baseline perbandingan ekuitas)
//   • Setoran modal tambahan & penarikan modal (prive) oleh pemilik
//   • Ringkasan: Modal Awal vs Ekuitas Saat Ini, terhubung otomatis dengan
//     seluruh transaksi lain (pembelian, penjualan, biaya, kas kecil) lewat
//     Neraca Saldo (journalService.trialBalance), karena semuanya sama-sama
//     posting ke buku besar double-entry.
// ─────────────────────────────────────────────────────────────────────────────
const capitalModel = require("../models/capitalModel");
const { ValidationError } = require("./productService");
const { toLocalDatetime, defaultDateRange } = require("./transactionService");
const journalService = require("./journalService");
const cashRegisterService = require("./cashRegisterService");

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function formatRupiah(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

// Tanggal H-1 dari sebuah tanggal (dipakai sebagai as_of_date Neraca Saldo
// "Modal Awal periode" — saldo SEBELUM tanggal mulai periode berjalan).
function dayBefore(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function generateCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `MDL${date}${rand}`;
}

const capitalService = {
  async record(payload, user) {
    const {
      transaction_date,
      type,
      amount,
      description,
      target_account,
      is_initial,
    } = payload;

    if (!transaction_date) {
      throw new ValidationError("Tanggal transaksi modal wajib diisi");
    }
    if (!["setoran", "penarikan"].includes(type)) {
      throw new ValidationError("Jenis transaksi modal tidak valid");
    }
    if (!amount || Number(amount) <= 0) {
      throw new ValidationError("Jumlah harus lebih dari 0");
    }
    const targetAccount = target_account || "kas";
    if (!["kas", "bank"].includes(targetAccount)) {
      throw new ValidationError("Akun tujuan tidak valid");
    }

    if (is_initial) {
      if (type !== "setoran") {
        throw new ValidationError(
          "Modal Awal harus berupa setoran, bukan penarikan",
        );
      }
      const existing = await capitalModel.findInitial();
      if (existing) {
        throw new ValidationError(
          `Modal Awal sudah pernah diinput pada ${existing.transaction_date} sebesar Rp ${Number(existing.amount).toLocaleString("id-ID")}. ` +
            `Gunakan "Setoran Modal Tambahan" untuk penambahan modal berikutnya.`,
        );
      }
    }

    const defaultDescription = is_initial
      ? "Setoran modal awal usaha"
      : type === "setoran"
        ? "Setoran modal tambahan"
        : "Penarikan modal (prive)";

    let shiftId = null;
    if (targetAccount === "kas") {
      const paymentSource =
        payload.payment_source === "laci" ? "laci" : "kantor";

      if (paymentSource === "laci") {
        const activeShift = await cashRegisterService.getActiveShift(user);
        if (!activeShift) {
          throw new ValidationError(
            'Tidak ada sesi kas (laci) yang sedang terbuka untuk Anda. Buka sesi kas dulu, atau pilih sumber dana "Kas Kantor".',
          );
        }
        if (
          type === "penarikan" &&
          Number(activeShift.expected_balance) < Number(amount)
        ) {
          throw new ValidationError(
            `Saldo Kas Laci tidak cukup untuk penarikan modal ini. Saldo laci saat ini Rp ${formatRupiah(activeShift.expected_balance)}, dibutuhkan Rp ${formatRupiah(amount)}.`,
          );
        }
        shiftId = activeShift.id;
      } else {
        if (type === "penarikan") {
          const currentBalance = await journalService.getCurrentBalance(
            journalService.ACC.KAS,
            transaction_date,
          );
          if (currentBalance < Number(amount)) {
            throw new ValidationError(
              `Saldo Kas Kantor tidak cukup untuk penarikan modal ini. Saldo saat ini Rp ${formatRupiah(currentBalance)}, dibutuhkan Rp ${formatRupiah(amount)}.`,
            );
          }
        }
        // shiftId TETAP null di sini — transaksi modal dari/ke Kas Kantor
        // sengaja tidak ditautkan ke laci kasir manapun (mirror pola
        // "kantor" di purchaseService/payableService).
      }
    }

    // Insert transaksi modal + posting jurnal terjadi dalam SATU DB
    // transaction di capitalModel.create — kalau jurnal gagal, transaksi
    // modal ini ikut rollback (tidak lagi best-effort).
    const tx = await capitalModel.create({
      transactionCode: generateCode(),
      transactionDate: transaction_date,
      type,
      isInitial: !!is_initial,
      targetAccount,
      amount: Number(amount),
      description: description || defaultDescription,
      recordedBy: user?.name || "Admin",
      shiftId,
      shiftUserId: user?.id, 
    });

    return tx;
  },

  async list({
    type,
    start_date,
    end_date,
    search,
    page = 1,
    limit = 20,
  } = {}) {
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const { total, rows } = await capitalModel.findAll({
      type,
      startDate: start_date,
      endDate: end_date,
      search,
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit,
    });
    return { data: rows, total, page: parsedPage, limit: parsedLimit };
  },

  // Ringkasan Modal Usaha: Modal Awal vs Ekuitas Saat Ini. Ekuitas Saat Ini
  // dihitung dari Neraca Saldo (saldo seluruh akun bertipe 'modal' + laba/rugi
  // kumulatif berjalan) — sehingga otomatis "nyambung" dengan pembelian,
  // penjualan, HPP, biaya operasional, dan kas kecil.
  async summary({ as_of_date } = {}) {
    const initial = await capitalModel.findInitial();
    const totals = await capitalModel.sumTotals();
    const asOfDate = as_of_date || toLocalDatetime().slice(0, 10);
    const trialBalance = await journalService.trialBalance({
      as_of_date: asOfDate,
    });

    const modalAwal = round2(initial ? Number(initial.amount) : 0);
    const totalSetoranTambahan = round2(
      Number(totals.total_setoran_tambahan || 0),
    );
    const totalPenarikan = round2(Number(totals.total_penarikan || 0));
    const labaRugiKumulatif = round2(trialBalance.summary.laba_rugi_berjalan);
    // Saldo seluruh akun bertipe 'modal' (Modal Pemilik + Prive) dari SEMUA
    // sumber — termasuk Modal Awal, setoran tambahan modul ini, dan setoran
    // modal dari Kas Kecil (kategori "Setoran Modal Tambahan"), karena semua
    // sama-sama posting ke akun 3100/3200.
    const totalModalDisetor = round2(trialBalance.summary.total_modal);
    const ekuitasSaatIni = round2(totalModalDisetor + labaRugiKumulatif);

    const selisih = round2(ekuitasSaatIni - modalAwal);
    const persentase =
      modalAwal > 0 ? round2((selisih / modalAwal) * 100) : null;
    const status =
      selisih > 0.009 ? "naik" : selisih < -0.009 ? "turun" : "tetap";

    return {
      as_of_date: asOfDate,
      has_modal_awal: !!initial,
      modal_awal: modalAwal,
      tanggal_modal_awal: initial ? initial.transaction_date : null,
      total_setoran_tambahan: totalSetoranTambahan,
      total_penarikan: totalPenarikan,
      laba_rugi_kumulatif: labaRugiKumulatif,
      total_modal_disetor: totalModalDisetor,
      ekuitas_saat_ini: ekuitasSaatIni,
      selisih_dari_modal_awal: selisih,
      persentase_perubahan: persentase,
      status,
      // Konteks tambahan dari Neraca Saldo, supaya kelihatan komponen asetnya.
      total_aset: trialBalance.summary.total_aset,
      total_kewajiban: trialBalance.summary.total_kewajiban,
      selisih_neraca: trialBalance.summary.selisih_neraca,
    };
  },

  /**
   * Laporan Perubahan Modal (Statement of Changes in Equity) untuk SATU
   * periode — laporan keuangan ke-3 di samping Laba Rugi & Neraca:
   *
   *   Modal Awal (saldo ekuitas per H-1 tanggal mulai periode)
   *   (+) Setoran Modal (dalam periode)
   *   (+) Laba Bersih Periode  — atau (–) Rugi Bersih Periode
   *   (–) Prive / Penarikan Modal (dalam periode)
   *   = Modal Akhir (saldo ekuitas per tanggal akhir periode)
   *
   * Modal Awal & Modal Akhir dihitung dari Neraca Saldo (akun tipe 'modal'
   * + laba/rugi kumulatif) per H-1 start_date & per end_date — SUMBER YANG
   * SAMA dengan Neraca Saldo Disesuaikan & Neraca, supaya otomatis
   * konsisten satu sama lain tanpa perlu dihitung ulang secara terpisah.
   * Laba Bersih Periode = selisih laba/rugi kumulatif antara kedua titik
   * itu (bukan dihitung ulang dari incomeStatement) — supaya baris
   * "Modal Awal + Setoran − Prive + Laba Bersih" DIJAMIN sama persis
   * dengan "Modal Akhir" (selisih_pengecekan harus selalu 0).
   *
   * Catatan: kalau Pajak Penghasilan aktif (lihat accountingService
   * .incomeStatement), Laba Bersih di sini adalah SEBELUM pajak — karena
   * pajak hanya dihitung di laporan, tidak pernah diposting sebagai jurnal
   * (tidak ada akun Utang Pajak). Laporan Laba Rugi menampilkan Laba
   * Bersih SETELAH pajak sebagai baris terpisah untuk info.
   */
  async equityStatement({ start_date, end_date } = {}) {
    const { startDate, endDate } = defaultDateRange(start_date, end_date);

    const [beginningTB, endingTB, movements] = await Promise.all([
      journalService.trialBalance({ as_of_date: dayBefore(startDate) }),
      journalService.trialBalance({ as_of_date: endDate }),
      capitalModel.sumTotalsInPeriod(startDate, endDate),
    ]);

    const beginningEquity = round2(
      beginningTB.summary.total_modal + beginningTB.summary.laba_rugi_berjalan,
    );
    const endingEquity = round2(
      endingTB.summary.total_modal + endingTB.summary.laba_rugi_berjalan,
    );

    const setoran = round2(Number(movements.total_setoran || 0));
    const penarikan = round2(Number(movements.total_penarikan || 0));
    const labaRugiPeriode = round2(
      endingTB.summary.laba_rugi_berjalan -
        beginningTB.summary.laba_rugi_berjalan,
    );

    const modalAkhirHitung = round2(
      beginningEquity + setoran - penarikan + labaRugiPeriode,
    );
    // Selisih pengecekan — harus selalu 0. Kalau tidak 0, berarti ada
    // transaksi modal yang tanggalnya di luar sinkron dengan jurnal
    // (seharusnya tidak terjadi karena capitalModel.create selalu posting
    // jurnal dengan entryDate = transaction_date yang sama).
    const selisihPengecekan = round2(endingEquity - modalAkhirHitung);

    return {
      start_date: startDate,
      end_date: endDate,
      modal_awal: beginningEquity,
      setoran_periode: setoran,
      penarikan_periode: penarikan,
      laba_rugi_periode: labaRugiPeriode,
      modal_akhir: endingEquity,
      selisih_pengecekan: selisihPengecekan,
    };
  },
};

module.exports = capitalService;
