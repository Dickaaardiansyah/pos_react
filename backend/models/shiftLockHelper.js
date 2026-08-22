
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
 * @returns {Promise<object|null>} baris cash_shifts (id, status,
 *   opened_by_user_id) yang sudah dikunci & tervalidasi, atau null kalau
 *   shiftId tidak diisi.
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
    "SELECT id, status, opened_by_user_id FROM cash_shifts WHERE id = ? FOR UPDATE",
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

module.exports = { lockOpenShift };
