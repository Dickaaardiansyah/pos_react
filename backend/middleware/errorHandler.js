// middleware/errorHandler.js
// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler
// Menangani seluruh error Express & MySQL sekaligus menampilkan log lengkap
// agar mudah debugging di Railway.
// ─────────────────────────────────────────────────────────────────────────────

function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `${req.method} ${req.originalUrl} tidak ditemukan`,
  });
}

function errorHandler(err, req, res, next) {
  console.error("\n======================================================");
  console.error("🚨 SERVER ERROR");
  console.error("======================================================");

  console.error("URL        :", `${req.method} ${req.originalUrl}`);
  console.error("Message    :", err.message);
  console.error("Code       :", err.code || "-");
  console.error("SQL     :", err.sql);
  console.error("Params  :", err.sqlMessage || err.parameters);
  console.error("Errno      :", err.errno || "-");
  console.error("SQL State  :", err.sqlState || "-");

  if (err.sql) {
    console.error("\nSQL:");
    console.error(err.sql);
  }

  if (err.sqlMessage) {
    console.error("\nSQL Message:");
    console.error(err.sqlMessage);
  }

  if (err.parameters) {
    console.error("\nParameters:");
    console.dir(err.parameters, { depth: null });
  }

  console.error("\nStack:");
  console.error(err.stack);

  console.error("======================================================\n");

  // Duplicate Entry
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(400).json({
      success: false,
      message: "Data duplikat.",
    });
  }

  // Foreign Key
  if (
    err.code === "ER_ROW_IS_REFERENCED" ||
    err.code === "ER_ROW_IS_REFERENCED_2"
  ) {
    return res.status(400).json({
      success: false,
      message: "Data masih digunakan oleh data lain.",
    });
  }

  // Validation
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Unauthorized
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      success: false,
      message: err.message,
    });
  }

  // Default Error
  // FIX (revisi dosen #18 — Internal error masih dikirim ke client):
  // sebelumnya err.message (termasuk pesan asli dari mysql2 — nama kolom,
  // nama tabel, bahkan potongan query) selalu dikirim balik ke client apa
  // adanya untuk SEMUA jenis error yang tidak match kondisi khusus di atas
  // (duplikat/FK/validasi/unauthorized punya pesan sendiri yang memang aman
  // ditampilkan). Untuk error tak terduga (status 500 — bug, koneksi DB
  // putus, dsb.), detail teknis itu HANYA berguna buat developer, dan malah
  // bisa membocorkan struktur database ke pengguna/penyerang. Detail
  // lengkapnya tetap ada di console.error di atas (masuk log server), tapi
  // yang dikirim ke client di production diseragamkan jadi pesan generik.
  // Di development, err.message tetap dikirim apa adanya supaya gampang
  // debug tanpa perlu bolak-balik cek log terminal.
  const status = err.status || 500;
  const message =
    status === 500 && process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

  return res.status(status).json({
    success: false,
    message,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
