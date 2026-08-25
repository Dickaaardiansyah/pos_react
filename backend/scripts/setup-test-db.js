// scripts/setup-test-db.js
// ─────────────────────────────────────────────────────────────────────────────
// Menyiapkan database khusus integration test (pos_refactor_test) dari file
// dump SQL asli: database/schema-dump.sql (export phpMyAdmin dari database
// pos_refactor kamu — struktur + data produksi/dev).
//
// Script ini HANYA mengambil strukturnya (CREATE TABLE, index, foreign key),
// baris INSERT dibuang — karena test harus mulai dari database KOSONG tiap
// kali jalan (data awal yang dibutuhkan tiap test di-seed sendiri oleh
// tests/setup/db.js → resetDatabase()/seedBaseUsers()).
//
// Kalau skema project berubah (nambah tabel/kolom baru), tinggal export
// ulang database pos_refactor kamu dari phpMyAdmin (Export → SQL), timpa
// file database/schema-dump.sql, lalu jalankan npm test lagi.
//
// Dijalankan otomatis lewat `npm test` (lihat package.json → pretest).
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config({ path: ".env.test" });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const TEST_DB = process.env.DB_NAME || "pos_refactor_test";
const DUMP_FILE = path.join(__dirname, "..", "database", "schema-dump.sql");

/**
 * Memecah teks SQL dump jadi array statement individual, dengan menghormati
 * tanda kutip ('...', "...", `...`) supaya titik-koma DI DALAM string/nama
 * kolom tidak dianggap sebagai akhir statement.
 */
function splitSqlStatements(sqlText) {
  const statements = [];
  let current = "";
  let quoteChar = null;

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    current += char;

    if (quoteChar) {
      if (char === "\\") {
        // escape karakter berikutnya (mis. \' di dalam string), lewati.
        current += sqlText[++i] || "";
      } else if (char === quoteChar) {
        quoteChar = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quoteChar = char;
    } else if (char === ";") {
      statements.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function main() {
  if (!fs.existsSync(DUMP_FILE)) {
    console.error(
      `❌ File dump tidak ditemukan: ${DUMP_FILE}\n` +
        `   Export database pos_refactor kamu dari phpMyAdmin (Export → SQL) dan ` +
        `simpan sebagai database/schema-dump.sql.`,
    );
    process.exit(1);
  }

  const rawSql = fs.readFileSync(DUMP_FILE, "utf8");
  const allStatements = splitSqlStatements(rawSql);

  // Buang: komentar (-- ... / diawali #), baris kosong, dan SEMUA statement
  // INSERT INTO (data produksi tidak ikut, test mulai dari tabel kosong).
  const schemaStatements = allStatements.filter((stmt) => {
    const s = stmt.replace(/^(--.*|\s)*/g, "").trim();
    if (!s) return false;
    if (/^\/\*/.test(s)) return false; // /*!40101 ... */ conditional comments
    if (/^INSERT\s+INTO/i.test(s)) return false;
    if (/^(START\s+TRANSACTION|COMMIT|SET\s+time_zone)/i.test(s)) return false;
    return true;
  });

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  console.log(
    `\n🔧 Menyiapkan database test "${TEST_DB}" dari database/schema-dump.sql...`,
  );

  await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await conn.query(
    `CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await conn.query(`USE \`${TEST_DB}\``);
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  let count = 0;
  for (const stmt of schemaStatements) {
    const cleanStmt = stmt.replace(/^(--.*\r?\n|\s)*/g, "").trim();
    try {
      await conn.query(stmt);
      if (/^CREATE\s+TABLE/i.test(cleanStmt)) {
        count++;
        const match = cleanStmt.match(/^CREATE\s+TABLE\s+`?(\w+)`?/i);
        console.log(`  ✓ ${match ? match[1] : "(tabel)"}`);
      }
    } catch (err) {
      console.error(
        `❌ Gagal menjalankan statement:\n${stmt.slice(0, 200)}...\n`,
        err.message,
      );
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      await conn.end();
      process.exit(1);
    }
  }

  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  await conn.end();

  console.log(
    `✅ Database test "${TEST_DB}" siap (${count} tabel, kosong tanpa data).\n`,
  );
}

main().catch((err) => {
  console.error("❌ Gagal menyiapkan database test:", err.message);
  process.exit(1);
});
