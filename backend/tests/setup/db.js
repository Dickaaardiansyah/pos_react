// tests/setup/db.js
// ─────────────────────────────────────────────────────────────────────────────
// Helper bersama untuk INTEGRATION TEST — konek ke database test asli
// (pos_refactor_test, lihat .env.test) dan reset datanya antar test.
//
// Dipakai di tiap file test seperti ini:
//
//   const { connectTestDb, closeTestDb, resetDatabase, seedBaseUsers } = require("../setup/db");
//
//   beforeAll(async () => { await connectTestDb(); });
//   afterAll(async () => { await closeTestDb(); });
//   beforeEach(async () => { await resetDatabase(); });
//
// PENTING: test yang pakai file ini WAJIB dijalankan serial (--runInBand),
// karena semua test berbagi satu database fisik yang sama — kalau jalan
// paralel, satu test bisa men-truncate tabel yang lagi dipakai test lain.
// Lihat package.json → jest.maxWorkers / test script.
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config({ path: ".env.test", override: true });

const bcrypt = require("bcryptjs");
const { createPool, closePool, getPool } = require("../../config/database");

async function connectTestDb() {
  if (process.env.DB_NAME !== "pos_refactor_test") {
    // Pengaman: kalau .env.test entah kenapa tidak ke-load, JANGAN sampai
    // test menyentuh database dev/production beneran.
    throw new Error(
      `Menolak konek: DB_NAME="${process.env.DB_NAME}" bukan database test. ` +
        `Pastikan .env.test ter-load (NODE_ENV=test).`,
    );
  }
  createPool();
}

async function closeTestDb() {
  await closePool();
}

/**
 * Mengosongkan SEMUA tabel di database test, lalu menyeed baris dasar yang
 * dibutuhkan banyak fitur (user admin & kasir) supaya foreign key seperti
 * transactions.user_id / journal_entries.created_by tetap valid.
 *
 * Dipanggil di beforeEach supaya tiap test mulai dari kondisi bersih & tidak
 * saling bocor data (menggantikan jest.clearAllMocks() di versi mocked-nya).
 */
async function resetDatabase() {
  const pool = getPool();

  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
  );

  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const row of tables) {
    await pool.query(`TRUNCATE TABLE \`${row.TABLE_NAME}\``);
  }
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");

  return seedBaseUsers();
}

/**
 * Seed user admin (id tetap 1) & kasir (id tetap 2) — dipakai sebagai
 * actor/created_by di hampir semua service (transaksi, jurnal, shift, dst.).
 * Password sengaja di-hash asal supaya tidak lolos validasi bcrypt.compare
 * secara tidak sengaja; test login pakai password mentah lain via helper ini.
 */
async function seedBaseUsers() {
  const pool = getPool();
  const passwordHash = await bcrypt.hash("password123", 4); // rounds rendah, test only

  await pool.query(
    `INSERT INTO users (id, name, username, password, role, is_active)
     VALUES (1, 'Admin Test', 'admin_test', ?, 'admin', 1),
            (2, 'Kasir Test', 'kasir_test', ?, 'cashier', 1)`,
    [passwordHash, passwordHash],
  );

  return { adminId: 1, cashierId: 2, rawPassword: "password123" };
}

module.exports = { connectTestDb, closeTestDb, resetDatabase, seedBaseUsers };
