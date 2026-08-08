// controllers/_helpers.js
// ─────────────────────────────────────────────────────────────────────────────
// Utilitas kecil dipakai semua controller: membungkus handler async supaya
// error otomatis diteruskan ke errorHandler tanpa try/catch berulang di
// setiap fungsi.
// ─────────────────────────────────────────────────────────────────────────────
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
