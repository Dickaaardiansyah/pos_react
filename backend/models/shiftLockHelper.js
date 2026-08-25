/**
 * Kunci baris cash_shifts (SELECT ... FOR UPDATE) DI DALAM transaction
 * `conn` yang sedang berjalan, lalu validasi statusnya masih 'open' dan
 * (opsional) kepemilikannya, sebelum caller melanjutkan ke INSERT/UPDATE
 * yang membawa shift_id ini.
 *
 * @param {*} conn - koneksi dari DB transaction yang sedang berjalan
 * @param {number|string|null|undefined} shiftId - id sesi kas yang mau
 *   dikunci. null/undefined berarti write ini TIDAK tertaut ke sesi kas
 *   manapun (mis. pembelian/pembayaran dari Kas/Bank Kantor, bukan dari
 *   laci kasir) — dalam kasus ini fungsi langsung return null tanpa query
 *   apa pun, supaya semua call-site tetap bisa panggil fungsi ini tanpa
 *   harus if-check shiftId dulu di tiap tempat.
 * @param {number|null} [userId] - id user (req.user.id) yang sedang
 *   melakukan aksi ini. Kalau diisi, kepemilikan shift ikut divalidasi —
 *   shift ini harus milik user ini. Shift lama/legacy yang
 *   opened_by_user_id-nya NULL SENGAJA dilewati dari pengecekan ini
 *   (konsisten dengan pola yang sudah dipakai di
 *   cashRegisterModel.createMovement/deleteMovement), supaya sesi kas
 *   peninggalan sebelum fitur kepemilikan-per-kasir ada tidak mendadak
 *   menolak semua write-nya. Kalau userId tidak diisi sama sekali,
 *   pengecekan kepemilikan dilewati sepenuhnya (dipakai di call-site yang
 *   memang belum/tidak menerapkan aturan kepemilikan, mis. checkout &
 *   pembayaran piutang saat ini).
 * @returns {Promise<object|null>} baris cash_shifts LENGKAP (SELECT *) yang
 *   sudah dikunci & tervalidasi, atau null kalau shiftId tidak diisi.
 *   Sengaja mengembalikan seluruh kolom (bukan cuma id/status/
 *   opened_by_user_id) supaya caller yang butuh field lain dari baris yang
 *   sudah terkunci ini — misalnya shift_code untuk posting jurnal — tidak
 *   perlu SELECT ulang di luar lock (yang lock-nya sudah dipegang connection
 *   ini, jadi baca ulang tanpa FOR UPDATE pun tetap konsisten, tapi lebih
 *   sederhana langsung pakai row yang sama).
 * @throws {NotFoundError} kalau shiftId diisi tapi baris shift-nya tidak ada
 * @throws {ValidationError} kalau shift sudah tidak berstatus 'open'
 * @throws {ForbiddenError} kalau shift ini milik user lain (userId diisi &
 *   opened_by_user_id shift bukan NULL/legacy)
 */
async function lockOpenShift(conn, shiftId, userId) {
  if (!shiftId) return null;

  // Lazy require — lihat catatan "fix circular dependency" di atas.
  const {
    ValidationError,
    NotFoundError,
  } = require("../services/productService");
  const { ForbiddenError } = require("../middleware/auth");

  const [rows] = await conn.execute(
    "SELECT * FROM cash_shifts WHERE id = ? FOR UPDATE",
    [shiftId],
  );
  const shift = rows[0];

  if (!shift) {
    throw new NotFoundError("Sesi kas tidak ditemukan");
  }
  if (shift.status !== "open") {
    throw new ValidationError(
      "Sesi kas untuk transaksi ini sudah ditutup. Buka/gunakan sesi kas yang aktif lalu ulangi transaksi",
    );
  }
  if (
    userId != null &&
    shift.opened_by_user_id != null &&
    shift.opened_by_user_id !== userId
  ) {
    throw new ForbiddenError(
      "Sesi kas ini sedang dipegang kasir lain. Anda tidak bisa mencatat transaksi pada sesi ini.",
    );
  }

  return shift;
}

/**
 
 *
 * Sebelumnya: validasi "saldo cukup?" dilakukan sebelum lock (di
 * purchaseService/payableService/accountingService/capitalService), lalu
 * baru masuk DB transaction & lock shift. Kalau dua request bersamaan
 * sama-sama membaca saldo lama yang sama, keduanya bisa lolos validasi,
 * lalu jalan berurutan begitu lock didapat satu-satu — request kedua tidak
 * pernah mengecek ulang bahwa saldo sudah berkurang gara-gara request
 * pertama. Sekarang: begini lock shift didapat, saldo dihitung ULANG dari
 * kondisi TERBARU (termasuk efek request lain yang baru saja commit) —
 * request kedua akan gagal dengan pesan saldo tidak cukup, bukan
 * meloloskan saldo jadi minus.
 *
 * @param {*} conn - koneksi dari DB transaction yang sedang berjalan
 * @param {number|string|null|undefined} shiftId - lihat lockOpenShift()
 * @param {number|null} [userId] - lihat lockOpenShift()
 * @param {number|null} [requiredAmount] - nominal yang akan dikeluarkan
 *   dari laci ini. null/undefined berarti caller cuma butuh lock + validasi
 *   status 'open' TANPA cek saldo (dipakai di call-site yang datanya
 *   menambah saldo, bukan mengurangi, mis. penerimaan pembayaran piutang,
 *   atau setoran modal).
 * @param {string} [actionLabel] - potongan kalimat pesan error, mis.
 *   "pembelian ini" / "pembayaran hutang ini".
 * @returns {Promise<object|null>} baris cash_shifts yang sudah dikunci,
 *   atau null kalau shiftId tidak diisi (mis. sumber dana Kas/Bank Kantor).
 * @throws {ValidationError} kalau saldo laci (setelah dihitung ulang di
 *   dalam lock) tidak cukup untuk requiredAmount
 */
async function lockShiftAndCheckBalance(
  conn,
  shiftId,
  userId,
  requiredAmount,
  actionLabel = "transaksi ini",
) {
  const shift = await lockOpenShift(conn, shiftId, userId);
  if (!shift) return null;
  if (requiredAmount == null) return shift;

  // Lazy require untuk menghindari circular dependency:
  // cashRegisterService -> cashRegisterModel -> shiftLockHelper.
  const cashRegisterService = require("../services/cashRegisterService");
  const { ValidationError } = require("../services/productService");

  const summary = await cashRegisterService.computeExpectedBalance(shift, conn);
  const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

  if (Number(summary.expected_balance) < Number(requiredAmount)) {
    throw new ValidationError(
      `Saldo Kas Laci "${shift.opened_by}" tidak cukup untuk ${actionLabel}. Saldo laci saat ini Rp ${fmt(summary.expected_balance)}, dibutuhkan Rp ${fmt(requiredAmount)}.`,
    );
  }

  return shift;
}

module.exports = { lockOpenShift, lockShiftAndCheckBalance };
