// backend/scripts/seed-admin.js
// ─────────────────────────────────────────────────────────────────────────────
// FIX (revisi dosen #15 — Default admin masih ada): init.sql dulu men-seed
// akun admin/admin123 & kasir1/kasir123 dengan password FIXED (dan disimpan
// base64, bukan hashing) langsung di source code — siapapun yang pegang
// repo otomatis tahu credential-nya. Script ini menggantikan seed itu:
// akun admin pertama dibuat di sini, di-hash LANGSUNG dengan bcrypt (tidak
// pernah lewat base64), dan passwordnya tidak pernah ditulis ke source code.
//
// Cara pakai:
//   npm run seed:admin
//
// Password diambil dari .env (ADMIN_USERNAME / ADMIN_PASSWORD) kalau ada.
// Kalau tidak diisi, password digenerate random & HANYA ditampilkan sekali
// di console saat script ini jalan — segera dicatat & disarankan diganti
// setelah login pertama. Script ini aman dijalankan berkali-kali: kalau
// sudah ada user dengan role admin di database, script akan berhenti tanpa
// membuat akun baru (supaya tidak sengaja bikin admin duplikat / menimpa).
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const {
  initializeDatabase,
  query,
  insert,
  getPool,
} = require("../config/database");

function generateRandomPassword() {
  // 16 karakter, base64url — cukup acak & tetap gampang diketik/disalin.
  return crypto.randomBytes(12).toString("base64url");
}

async function seedAdmin() {
  await initializeDatabase();

  const existingAdmin = await query(
    "SELECT id, username FROM users WHERE role = 'admin' LIMIT 1",
  );

  if (existingAdmin.length > 0) {
    console.log(
      `\nℹ️  Sudah ada akun admin ("${existingAdmin[0].username}"). Seed dibatalkan — tidak ada perubahan.`,
    );
    console.log(
      "   Kalau perlu reset password admin, lakukan lewat menu Pengaturan > Pengguna (setelah login), bukan lewat script ini.\n",
    );
    await getPool().end();
    return;
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || generateRandomPassword();
  const generated = !process.env.ADMIN_PASSWORD;

  const usernameTaken = await query("SELECT id FROM users WHERE username = ?", [
    username,
  ]);
  if (usernameTaken.length > 0) {
    console.error(
      `\n❌ Username "${username}" sudah dipakai (tapi bukan oleh akun admin). Ganti ADMIN_USERNAME di .env lalu coba lagi.\n`,
    );
    await getPool().end();
    process.exit(1);
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  await insert(
    "INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, 'admin')",
    ["Administrator", username, hashedPassword],
  );

  console.log("\n✅ Akun admin berhasil dibuat.\n");
  console.log("=".repeat(50));
  console.log(`Username : ${username}`);
  console.log(`Password : ${password}`);
  console.log("=".repeat(50));
  if (generated) {
    console.log(
      "\n⚠️  Password di atas digenerate random dan HANYA ditampilkan sekali.",
    );
    console.log(
      "   Catat sekarang, lalu segera login dan ganti lewat menu Pengaturan.\n",
    );
  } else {
    console.log(
      "\n(Password diambil dari ADMIN_PASSWORD di .env — pertimbangkan menghapusnya dari .env setelah dicatat.)\n",
    );
  }

  await getPool().end();
}

seedAdmin().catch((err) => {
  console.error("\n❌ Gagal membuat akun admin:", err.message);
  process.exit(1);
});
