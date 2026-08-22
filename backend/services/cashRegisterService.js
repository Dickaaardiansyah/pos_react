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
//                  + total_piutang_tunai_diterima + total_setoran_modal_tunai
//                  - total_kas_keluar - total_hutang_tunai_dibayar
//                  - total_pembelian_tunai - total_prive_tunai
//                  - total_biaya_operasional
//   selisih      = kas_fisik - saldo_sistem
//
// "total_penjualan_tunai" mencakup transaksi tunai penuh DAN DP tunai
// transaksi Open Bill (lihat cashRegisterModel.sumCashSales) — keduanya
// sama-sama di-debit ke akun Kas (1100) oleh journalService.postSaleJournal.
//
// FIX (revisi dosen #17): pembayaran piutang/hutang tunai, pembelian tunai,
// setoran/prive modal tunai, dan biaya operasional TIDAK LAGI diabaikan.
// Kelima kategori itu ditautkan ke sesi kas aktif lewat shift_id (diisi di
// purchaseService/payableService/receivableService/capitalService/
// accountingService HANYA kalau metode bayarnya tunai/kas DAN ada sesi kas
// yang sedang terbuka saat transaksi dicatat), lalu dijumlahkan di
// buildShiftSummary() di bawah. Kalau tidak ada sesi kas terbuka saat
// transaksi itu dicatat (shift_id NULL), transaksi itu memang tidak
// dianggap menyentuh laci kasir manapun — konsisten dengan cara toko ini
// membedakan "uang di laci kasir" vs "uang di kas besar/brankas/bank" saat
// sedang tidak ada shift aktif.
//
// CATATAN SKOP: modul ini tetap merepresentasikan laci kasir harian, BUKAN
// saldo akun Kas (COA 1100) di pembukuan secara keseluruhan — kalau
// transaksi2 di atas TIDAK dibayar/diterima dari laci fisik yang sama
// (mis. toko punya kas besar terpisah), shift_id-nya akan NULL dengan
// sendirinya (tidak ada sesi terbuka saat dicatat), dan modul ini tidak
// akan salah menghitungnya sebagai bagian dari laci kasir.
// ─────────────────────────────────────────────────────────────────────────────
const cashRegisterModel = require("../models/cashRegisterModel");
const { ValidationError, NotFoundError } = require("./productService");
const { ForbiddenError } = require("../middleware/auth");
const { toLocalDatetime, defaultDateRange } = require("./transactionService");

// FIX (revisi: sesi kas per kasir, bukan global): sebelumnya
// findActiveShift() mengambil SATU sesi kas 'open' secara global (bukan
// per-user) — kalau kasir A membuka sesi, kasir B TIDAK BISA membuka
// sesinya sendiri sampai kasir A menutup dulu, karena backend menganggap
// hanya boleh ada satu sesi terbuka di seluruh toko. Sekarang tiap kasir
// membuka & memakai sesi kasnya masing-masing secara independen — lihat
// cashRegisterModel.findActiveShift(userId)/findOwnOpenShift(userId).
// Beberapa kasir boleh punya sesi kas terbuka bersamaan (mis. toko dengan
// beberapa laci/terminal fisik); yang TIDAK boleh adalah satu kasir yang
// sama membuka DUA sesi sekaligus (dicegah di openShift()).
//
// assertOwnsShift() dipertahankan sebagai lapisan kedua di setiap mutasi
// (createMovement, deleteMovement, closeShift) — sebelumnya ini satu-
// satunya penjaga karena resolusi sesi masih global; sekarang resolusi
// sesi sudah tersaring ke milik user itu sendiri sejak awal, jadi
// assertOwnsShift jadi defense-in-depth untuk kasus sesi legacy ber-owner
// NULL (lihat catatan di findActiveShift model).
//
// Shift lama (dibuka sebelum migration cash_shift_ownership.sql, sehingga
// opened_by_user_id-nya NULL) sengaja tetap diizinkan siapapun menutupnya —
// supaya data lama tidak "terkunci" tanpa pemilik yang bisa menutupnya.
//
// FIX (revisi dosen #19): bypass NULL di bawah ini SEKARANG SEHARUSNYA TIDAK
// PERNAH tercapai lagi dalam kondisi normal — setiap pemanggil fungsi ini
// (createMovement, deleteMovement, closeShift) sudah mengklaim shift
// ber-owner NULL untuk kasir yang sedang login SEBELUM sampai ke sini
// (lihat claimIfOrphan() di bawah, dan cashRegisterModel.findActiveShift()
// / claimOrphanShift()). Bypass ini dipertahankan sebagai lapisan
// defense-in-depth terakhir untuk kasus yang tidak terduga (mis. klaim
// gagal karena error DB yang entah bagaimana tidak ikut menghentikan alur),
// BUKAN lagi mekanisme utama yang membiarkan banyak kasir berbagi satu
// shift ber-owner NULL secara bergantian.
function assertOwnsShift(shift, user, action) {
  if (shift.opened_by_user_id != null && shift.opened_by_user_id !== user.id) {
    throw new ForbiddenError(
      `Sesi kas ini sedang dipegang kasir lain (${shift.opened_by}). Anda tidak bisa ${action} sesi ini.`,
    );
  }
}

// FIX (revisi dosen #19): dipakai HANYA di titik yang mengambil shift lewat
// cashRegisterModel.findShiftById() secara langsung (bukan lewat
// findActiveShift(), yang sudah mengklaim otomatis di model) — yaitu
// closeShift & deleteMovement di bawah. Kalau shift yang diambil ternyata
// masih ber-owner NULL (legacy), klaim SEKARANG untuk user yang sedang
// login, sebelum assertOwnsShift() dipanggil — supaya kasir lain tidak
// bisa lagi ikut "menemukan" & memakai shift yang sama sebagai miliknya
// setelah titik ini.
async function claimIfOrphan(shift, user) {
  if (shift.opened_by_user_id != null) return shift;
  const claimedNow = await cashRegisterModel.claimOrphanShift(
    shift.id,
    user.id,
  );
  if (claimedNow) {
    return { ...shift, opened_by_user_id: user.id };
  }
  // Kalah race klaim (kasir lain menang duluan) — ambil data TERBARU supaya
  // assertOwnsShift() memeriksa kepemilikan yang sebenarnya sekarang, bukan
  // snapshot lama yang masih terlihat NULL.
  const fresh = await cashRegisterModel.findShiftById(shift.id);
  return fresh || shift;
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
//
// FIX (revisi dosen #17): sebelumnya expectedBalance HANYA menghitung
// penjualan tunai + cash_movements manual — mengabaikan pembayaran
// piutang/hutang tunai, pembelian tunai, setoran/prive modal tunai, dan
// biaya operasional, padahal kelima-limanya sama-sama menyentuh laci kasir
// fisik kalau memang dibayar/diterima dari situ (lihat shift_id yang
// sekarang diisi di purchaseService/payableService/receivableService/
// capitalService/accountingService). Sekarang kelimanya ikut dijumlahkan
// dari sini, per shift_id — bukan lagi diam-diam diabaikan.
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

  const [
    cashSalesRow,
    receivableRow,
    payableRow,
    purchaseRow,
    capitalRow,
    expenseRow,
  ] = await Promise.all([
    cashRegisterModel.sumCashSales(shift.id),
    cashRegisterModel.sumCashReceivablePayments(shift.id),
    cashRegisterModel.sumCashPayablePayments(shift.id),
    cashRegisterModel.sumCashPurchases(shift.id),
    cashRegisterModel.sumCashCapital(shift.id),
    cashRegisterModel.sumCashExpenses(shift.id),
  ]);

  const totalCashSales = round2(cashSalesRow?.total_cash_sales || 0);
  // Kas MASUK tambahan di luar penjualan & cash_movements manual:
  const totalCashReceivable = round2(receivableRow?.total || 0); // pembayaran piutang tunai diterima
  const totalCashCapitalIn = round2(capitalRow?.total_in || 0); // setoran modal tunai
  // Kas KELUAR tambahan di luar cash_movements manual:
  const totalCashPayable = round2(payableRow?.total || 0); // pembayaran hutang tunai
  const totalCashPurchase = round2(purchaseRow?.total || 0); // pembelian tunai
  const totalCashCapitalOut = round2(capitalRow?.total_out || 0); // prive tunai
  const totalCashExpense = round2(expenseRow?.total || 0); // biaya operasional

  const expectedBalance = round2(
    Number(shift.opening_balance) +
      totalCashSales +
      totalCashIn +
      totalCashReceivable +
      totalCashCapitalIn -
      totalCashOut -
      totalCashPayable -
      totalCashPurchase -
      totalCashCapitalOut -
      totalCashExpense,
  );

  return {
    ...shift,
    movements,
    total_cash_sales: totalCashSales,
    total_cash_in: totalCashIn,
    total_cash_out: totalCashOut,
    total_cash_receivable: totalCashReceivable,
    total_cash_payable: totalCashPayable,
    total_cash_purchase: totalCashPurchase,
    total_cash_capital_in: totalCashCapitalIn,
    total_cash_capital_out: totalCashCapitalOut,
    total_cash_expense: totalCashExpense,
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
    // FIX (sesi kas per kasir): resolve sesi 'open' MILIK user ini, bukan
    // sesi 'open' siapa pun di toko — lihat catatan di
    // cashRegisterModel.findActiveShift().
    const shift = await cashRegisterModel.findActiveShift(user?.id);
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

  // FIX (revisi dosen #14): dipakai ADMIN untuk memilih secara EKSPLISIT
  // laci kasir mana yang menjadi Sumber Dana pembelian/pembayaran hutang/
  // biaya/modal — mengganti asumsi lama "shift milik user yang sedang
  // login" (yang selalu gagal untuk admin, karena admin tidak pernah
  // membuka sesi kas sendiri — lihat catatan di purchaseService
  // .recordPurchase() / payableService.recordPayment()). Dipakai juga
  // untuk mengisi dropdown "Pilih Laci Kasir" di frontend. Tidak
  // menyertakan `movements` per shift (beda dari buildShiftSummary penuh)
  // supaya list ini ringan; expected_balance tetap dihitung karena itu
  // yang dibutuhkan untuk validasi saldo cukup/tidak sebelum transaksi.
  async listOpenShifts() {
    const shifts = await cashRegisterModel.findAllOpenShifts();
    return Promise.all(
      shifts.map(async (shift) => {
        const summary = await buildShiftSummary(shift);
        return {
          id: summary.id,
          shift_code: summary.shift_code,
          opened_by: summary.opened_by,
          opened_by_user_id: summary.opened_by_user_id,
          cashier_name: shift.cashier_name || summary.opened_by,
          opened_at: summary.opened_at,
          expected_balance: summary.expected_balance,
        };
      }),
    );
  },

  // FIX (revisi dosen #14): dipakai modul lain (purchaseService/
  // payableService/accountingService/capitalService) untuk mengambil &
  // memvalidasi SATU laci kasir spesifik yang dipilih admin lewat
  // payload.shift_id (Sumber Dana = 'laci'), lengkap dengan
  // expected_balance-nya. Beda dari getActiveShift() yang resolve
  // berdasarkan IDENTITAS user yang login — di sini shift-nya SUDAH
  // ditentukan secara eksplisit oleh pemanggil (shiftId), jadi tetap bisa
  // dipakai walau yang login (admin) bukan pemilik shift itu. Ownership
  // check tetap ditegakkan di lapisan model (lockOpenShift, di dalam DB
  // transaction) memakai opened_by_user_id ASLI dari shift ini — BUKAN
  // req.user.id admin — supaya validasi kepemilikan tetap bermakna kalau
  // suatu saat kasir juga diizinkan memakai alur yang sama.
  async getOpenShiftById(shiftId) {
    const shift = await cashRegisterModel.findShiftById(shiftId);
    if (!shift || shift.status !== "open") return null;
    return buildShiftSummary(shift);
  },

  async openShift(payload, user) {
    // FIX (revisi: sesi kas per kasir, bukan global): dulu dicek apakah
    // ADA sesi 'open' sama sekali di toko (findActiveShift() global) —
    // begitu kasir A buka kas, kasir B jadi tidak bisa buka kas SENDIRI
    // sampai kasir A tutup dulu. Sekarang tiap kasir independen: yang
    // dicek adalah apakah KASIR INI (user.id) SENDIRI sudah punya sesi
    // terbuka, bukan apakah ada sesi terbuka sama sekali di toko.
    const existing = await cashRegisterModel.findOwnOpenShift(user.id);
    if (existing) {
      throw new ValidationError(
        `Anda masih memiliki sesi kas yang terbuka (${existing.shift_code}). Tutup kas Anda terlebih dahulu sebelum membuka sesi baru`,
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
    // FIX (sesi kas per kasir): ambil sesi 'open' MILIK user ini sendiri,
    // bukan sesi 'open' global — lihat cashRegisterModel.findActiveShift().
    const shift = await cashRegisterModel.findActiveShift(user?.id);
    if (!shift) {
      throw new ValidationError(
        "Tidak ada sesi kas yang sedang Anda buka. Buka kas terlebih dahulu",
      );
    }
    // FIX KEAMANAN: dipertahankan sebagai lapisan pertahanan kedua
    // (defense-in-depth) meskipun findActiveShift(user.id) di atas sudah
    // menyaring ke sesi milik user ini — assertOwnsShift tetap relevan
    // untuk kasus sesi legacy ber-owner NULL (dua kasir berbeda bisa
    // sama-sama "menemukan" sesi legacy yang sama sebagai sesi aktif
    // mereka; assertOwnsShift tidak memblokir kasus itu karena owner-nya
    // memang NULL, tapi tetap memblokir kalau shift ternyata sudah
    // dimiliki user lain yang jelas).
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
    //
    // FIX (revisi dosen #20): shift & user.id di atas HANYA dipakai sebagai
    // fast-path check (pesan error awal yang cepat) — cek yang SEBENARNYA
    // menentukan (atomic, di dalam SELECT ... FOR UPDATE + transaction) ada
    // di cashRegisterModel.createMovement() sekarang. createdByUserId
    // dikirim supaya model bisa re-validasi ownership dari data yang sudah
    // terkunci, bukan dari shift yang mungkin sudah basi di sini.
    await cashRegisterModel.createMovement({
      shiftId: shift.id,
      type,
      category,
      amount: Number(amount),
      description: description,
      createdBy: user.name,
      createdByUserId: user.id,
      occurredAt: toLocalDatetime(),
    });

    const updated = await cashRegisterModel.findShiftById(shift.id);
    return buildShiftSummary(updated);
  },

  async deleteMovement(id, user) {
    const movement = await cashRegisterModel.findMovementById(id);
    if (!movement)
      throw new NotFoundError("Data pergerakan kas tidak ditemukan");

    let shift = await cashRegisterModel.findShiftById(movement.shift_id);
    if (!shift || shift.status !== "open") {
      throw new ValidationError(
        "Hanya pergerakan kas pada sesi yang masih terbuka yang dapat dihapus",
      );
    }
    // FIX (revisi dosen #19): shift di sini diambil lewat findShiftById
    // langsung (bukan findActiveShift, yang sudah auto-klaim di model) —
    // klaim dulu kalau masih ber-owner NULL, sebelum assertOwnsShift.
    shift = await claimIfOrphan(shift, user);
    // FIX KEAMANAN: hanya kasir pemilik sesi yang boleh menghapus catatan
    // kas pada sesi itu.
    assertOwnsShift(shift, user, "menghapus catatan kas pada");

    // Hapus pergerakan kas + posting jurnal pembalik terjadi dalam SATU DB
    // transaction di cashRegisterModel.deleteMovement — supaya General
    // Ledger ikut menyesuaikan, bukan cuma baris cash_movements yang hilang
    // (lihat catatan revisi dosen: hapus cash movement sebelumnya tidak
    // membalik jurnal, sehingga GL tetap mengurangi/menambah kas padahal
    // transaksinya sudah dibatalkan).
    //
    // FIX (revisi dosen #20): shift yang dicek/diklaim di atas (findShiftById
    // + claimIfOrphan) HANYA fast-path — cek yang SEBENARNYA menentukan
    // (shift dikunci FOR UPDATE & status/ownership divalidasi ulang di
    // dalam transaction) sekarang ada di cashRegisterModel.deleteMovement()
    // sendiri, memakai movement.shift_id yang diambil ulang di sana, bukan
    // lagi shift.shift_code yang mungkin sudah basi sejak dibaca di atas.
    await cashRegisterModel.deleteMovement(id, user.id);
    const updated = await cashRegisterModel.findShiftById(shift.id);
    return buildShiftSummary(updated);
  },

  async closeShift(id, payload, user) {
    let shift = await cashRegisterModel.findShiftById(id);
    if (!shift) throw new NotFoundError("Sesi kas tidak ditemukan");
    // Pengecekan status di sini HANYA fast-path untuk pesan error awal yang
    // cepat (mis. kasir tidak sengaja klik tutup kas dua kali) — bukan lagi
    // satu-satunya penjaga. Cek yang SEBENARNYA menentukan (atomic, di dalam
    // SELECT ... FOR UPDATE + transaction) ada di cashRegisterModel.closeShift()
    // — lihat catatan FIX (revisi dosen #13) di sana.
    if (shift.status !== "open") {
      throw new ValidationError("Sesi kas ini sudah ditutup sebelumnya");
    }
    // FIX (revisi dosen #19): shift di sini diambil lewat findShiftById
    // langsung (bukan findActiveShift, yang sudah auto-klaim di model) —
    // klaim dulu kalau masih ber-owner NULL, sebelum assertOwnsShift, supaya
    // kasir lain tidak bisa lagi menutup shift legacy yang sama ini sebagai
    // "miliknya" hanya karena owner-nya masih NULL.
    shift = await claimIfOrphan(shift, user);
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

    const physical = round2(closing_balance_physical);

    // FIX (revisi dosen #18 — race checkout vs tutup kas): summary TIDAK
    // LAGI dihitung di sini, sebelum transaction/lock cashRegisterModel.
    // closeShift() dimulai — itu sumber bug-nya (lihat catatan lengkap di
    // cashRegisterModel.closeShift). Sekarang buildShiftSummary hanya
    // dikirim sebagai CALLBACK (`buildSummary`), dan model yang memanggilnya
    // — setelah SELECT ... FOR UPDATE berhasil mengunci baris shift ini,
    // sehingga penjualan yang masuk tepat berbarengan dengan proses tutup
    // kas (lewat lock cash_shifts yang sama di transactionModel.createSale)
    // dijamin sudah tercatat/ditolak dengan pasti sebelum angka final
    // dihitung, bukan lagi angka yang sudah "basi" sejak sebelum lock.
    //
    // Tutup sesi + posting jurnal selisih (jika ada) terjadi dalam SATU DB
    // transaction di cashRegisterModel.closeShift — kalau jurnal gagal,
    // penutupan sesi ini ikut rollback (tidak lagi best-effort).
    // closed_by juga dari identitas login, bukan payload.closed_by.
    const closed = await cashRegisterModel.closeShift(id, {
      closingBalancePhysical: physical,
      closingNotes: closing_notes,
      closedBy: user.name,
      closedByUserId: user.id,
      occurredAt: toLocalDatetime(),
      buildSummary: (shiftRow) => buildShiftSummary(shiftRow),
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
