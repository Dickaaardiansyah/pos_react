// middleware/loginRateLimit.js
// ─────────────────────────────────────────────────────────────────────────────
// FIX (revisi dosen #16 — Login tidak punya rate limiting): POST /api/auth/login
// sebelumnya bisa dicoba tanpa batas, membuka celah brute-force credential.
//
// Batasnya: 5 percobaan gagal / 15 menit, dikunci per kombinasi IP+username
// (bukan per-IP saja atau per-username saja) —
//   - per-IP saja: satu penyerang bisa memblokir SEMUA user lain yang
//     kebetulan login dari IP yang sama (mis. satu jaringan toko/WiFi).
//   - per-username saja: penyerang dari banyak IP tetap bisa memblokir
//     akun tertentu (login gagal terus dari IP lain jadi selalu diblok).
// Kombinasi IP+username mencegah brute-force tanpa saling mengunci user lain.
//
// Progressive delay: percobaan ke-3 & ke-4 dalam window yang sama ditunda
// sebentar (bukan langsung diblok) sebelum akhirnya diblok penuh di
// percobaan ke-6, supaya credential-stuffing otomatis makin lambat & tidak
// efisien tanpa langsung mengganggu user yang salah ketik password.
// ─────────────────────────────────────────────────────────────────────────────
const rateLimit = require("express-rate-limit");

const WINDOW_MS = 15 * 60 * 1000; // 15 menit
const MAX_ATTEMPTS = 5;

function keyFromRequest(req) {
  const username = (req.body && req.body.username) || "unknown";
  return `${req.ip}:${String(username).toLowerCase().trim()}`;
}

// Percobaan ke-3 & ke-4 kena delay singkat (1detik, 2detik) sebelum lanjut
// ke handler login — bukan diblok, hanya diperlambat.
const attemptDelays = new Map();

function progressiveDelay(req, res, next) {
  const key = keyFromRequest(req);
  const count = (attemptDelays.get(key) || 0) + 1;
  attemptDelays.set(key, count);

  // Bersihkan counter ini juga mengikuti window yang sama dengan rate limiter.
  // .unref() supaya timer 15 menit ini tidak menahan proses Node tetap hidup
  // (mis. saat script/test lain selesai tapi proses tidak exit karena masih
  // ada timer pending).
  setTimeout(() => {
    if (attemptDelays.get(key) === count) attemptDelays.delete(key);
  }, WINDOW_MS).unref();

  const extraDelayMs = count === 3 ? 1000 : count === 4 ? 2000 : 0;
  if (extraDelayMs > 0) {
    return setTimeout(next, extraDelayMs);
  }
  return next();
}

const loginLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFromRequest,
  // Hanya percobaan yang GAGAL yang dihitung ke kuota — login sukses tidak
  // ikut memenuhi limit, supaya user yang memang aktif login berkali-kali
  // (mis. beberapa kasir gantian pakai perangkat yang sama) tidak keblokir.
  skipSuccessfulRequests: true,
  handler(req, res) {
    res.status(429).json({
      success: false,
      message:
        "Terlalu banyak percobaan login gagal. Silakan coba lagi dalam 15 menit.",
    });
  },
});

module.exports = { loginLimiter, progressiveDelay };
