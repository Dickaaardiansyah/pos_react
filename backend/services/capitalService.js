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
const { toLocalDatetime } = require("./transactionService");
const journalService = require("./journalService");

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function generateCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `MDL${date}${rand}`;
}

const capitalService = {
  async record(payload) {
    const {
      transaction_date,
      type,
      amount,
      description,
      target_account,
      recorded_by,
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
      recordedBy: recorded_by || "Admin",
    });

    return tx;
  },

  async list({ type, start_date, end_date, page = 1, limit = 20 } = {}) {
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const { total, rows } = await capitalModel.findAll({
      type,
      startDate: start_date,
      endDate: end_date,
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
};

module.exports = capitalService;
