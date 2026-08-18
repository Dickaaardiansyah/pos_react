// middleware/auth.js
// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE — autentikasi (JWT) & otorisasi (peran/role).
//
//   authenticate  : wajib dipasang di semua route API yang butuh login.
//                   Memverifikasi token JWT dari header Authorization, lalu
//                   mengisi req.user = { id, username, name, role }.
//   authorize(...) : dipasang SETELAH authenticate pada route tertentu untuk
//                   membatasi akses hanya untuk role tertentu, mis.
//                   authorize("admin") hanya mengizinkan admin.
// ─────────────────────────────────────────────────────────────────────────────
const jwt = require("jsonwebtoken");
const settingModel = require("../models/settingModel");

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.status = 401;
  }
}
class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.status = 403;
  }
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(
      new UnauthorizedError(
        "Token autentikasi tidak ditemukan. Silakan login kembali",
      ),
    );
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // FIX KEAMANAN (review dosen): sebelumnya role/status aktif HANYA
    // dipercaya dari isi token JWT, tanpa pernah dicek ulang ke tabel
    // users. Akibatnya kalau admin menonaktifkan user atau mengubah
    // role-nya, perubahan itu TIDAK berlaku sampai token lama itu
    // kedaluwarsa (JWT_EXPIRES_IN di .env, default 8 jam) — kasir yang
    // sudah dinonaktifkan tetap bisa checkout, dsb. Sekarang setiap
    // request terautentikasi diverifikasi ulang ke DB: kalau user sudah
    // dihapus/nonaktif, token langsung ditolak; role juga SELALU diambil
    // dari DB saat ini (bukan dari klaim role di dalam token), supaya
    // downgrade/upgrade role langsung berlaku di request berikutnya.
    const fresh = await settingModel.findAuthStatusById(payload.id);
    if (!fresh || !fresh.is_active) {
      return next(
        new UnauthorizedError("Akun Anda telah dinonaktifkan. Hubungi admin"),
      );
    }

    req.user = {
      id: payload.id,
      username: payload.username,
      name: payload.name,
      role: fresh.role,
    };
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(
        new UnauthorizedError(
          "Sesi login telah berakhir. Silakan login kembali",
        ),
      );
    }
    return next(
      new UnauthorizedError(
        "Token autentikasi tidak valid. Silakan login kembali",
      ),
    );
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Silakan login terlebih dahulu"));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          "Anda tidak memiliki akses untuk melakukan aksi ini",
        ),
      );
    }
    return next();
  };
}

module.exports = { authenticate, authorize, UnauthorizedError, ForbiddenError };
