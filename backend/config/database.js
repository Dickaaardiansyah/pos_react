// config/database.js
// ============================================================================
// MySQL Database Configuration
// Menggunakan mysql2/promise + Connection Pool
// Dilengkapi logging SQL agar mudah debugging di Railway
// ============================================================================

const mysql = require("mysql2/promise");

let pool = null;

/**
 * Membuat Connection Pool
 */
function createPool() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "pos_system",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    timezone: "+07:00",
    charset: "utf8mb4",

    // PENTING: tanpa ini, mysql2 mengonversi kolom DATE/DATETIME/TIMESTAMP
    // jadi objek JS Date (menafsirkan nilai mentahnya sebagai zona `timezone`
    // di atas), yang kemudian di-serialize res.json() jadi string ISO UTC
    // (mis. "08:59" WIB → "...T02:00:00.000Z"). Frontend (parseLocalDate di
    // utils/format.js) mengasumsikan string APA ADANYA tanpa info zona waktu
    // ("2026-08-13 08:59:24") dan langsung membaca angka jamnya sebagai waktu
    // lokal — begitu backend mulai mengirim string UTC ber-"Z", jam yang
    // ditampilkan meleset 7 jam (mis. transaksi jam 09:00 tampil jam 02:00
    // di Riwayat Transaksi). dateStrin  dateStrings: true,gs: true membuat mysql2 mengirim
    // kolom tanggal sebagai string mentah lagi, cocok dengan asumsi frontend.
    dateStrings: true,

    // Tanpa ini, kolom DECIMAL (stock, physical_stock, quantity, harga, dst.)
    // dikembalikan mysql2 sebagai STRING berpadding, mis. 222.25 → "222.250".
    // Kalau string itu langsung dirender di UI tanpa parseFloat/format, akan
    // terbaca sebagai "222 ribu 250" dalam notasi angka Indonesia — sangat
    // membingungkan & pernah bikin salah baca stok. decimalNumbers: true
    // membuat driver otomatis mengonversinya jadi JS number di semua query.
    decimalNumbers: true,
  });

  return pool;
}

/**
 * Mengambil pool yang sudah dibuat
 */
function getPool() {
  if (!pool) {
    throw new Error("Database pool belum diinisialisasi.");
  }

  return pool;
}

/**
 * Helper untuk menampilkan SQL Error
 */
function logSqlError(err, sql, params) {
  console.error("\n====================================================");
  console.error("🚨 MYSQL ERROR");
  console.error("====================================================");

  console.error("Message :", err.message);
  console.error("Code    :", err.code || "-");
  console.error("Errno   :", err.errno || "-");
  console.error("SQLState:", err.sqlState || "-");

  console.error("\nSQL:");
  console.error(sql);

  console.error("\nParameters:");
  console.dir(params, { depth: null });

  console.error("\nStack:");
  console.error(err.stack);

  console.error("====================================================\n");
}

/**
 * Mengubah nilai LIMIT/OFFSET jadi integer aman untuk disisipkan langsung
 * ke dalam string SQL (BUKAN lewat parameter binding).
 *
 * Kenapa? mysql2 (prepared statement / execute()) punya bug lama:
 * mengirim LIMIT ? OFFSET ? sebagai parameter binding sering menghasilkan
 * error "Incorrect arguments to mysqld_stmt_execute" di banyak versi
 * MySQL/MariaDB (termasuk yang dipakai Railway). Solusi paling stabil
 * adalah memvalidasi nilainya sebagai integer lalu menyisipkannya langsung
 * ke SQL string (aman karena sudah dipastikan berupa angka bulat, bukan
 * input mentah dari user).
 */
function safeInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/**
 * SELECT
 */
async function query(sql, params = []) {
  try {
    const [rows] = await getPool().execute(sql, params);
    return rows;
  } catch (err) {
    logSqlError(err, sql, params);
    throw err;
  }
}

/**
 * SELECT satu baris
 */
async function queryOne(sql, params = []) {
  try {
    const rows = await query(sql, params);
    return rows[0] || null;
  } catch (err) {
    throw err;
  }
}

/**
 * INSERT
 */
async function insert(sql, params = []) {
  try {
    const [result] = await getPool().execute(sql, params);

    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
    };
  } catch (err) {
    logSqlError(err, sql, params);
    throw err;
  }
}

/**
 * UPDATE / DELETE
 */
async function execute(sql, params = []) {
  try {
    const [result] = await getPool().execute(sql, params);

    return {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
    };
  } catch (err) {
    logSqlError(err, sql, params);
    throw err;
  }
}

/**
 * Database Transaction
 */
async function transaction(callback) {
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    const result = await callback(conn);

    await conn.commit();

    return result;
  } catch (err) {
    await conn.rollback();

    console.error("\n============== TRANSACTION ROLLBACK ==============");
    console.error(err);
    console.error("==================================================\n");

    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Test koneksi database
 */
async function initializeDatabase() {
  console.log("================================================");
  console.log("DATABASE CONFIG");
  console.log("================================================");

  console.table({
    Host: process.env.DB_HOST,
    Port: process.env.DB_PORT,
    User: process.env.DB_USER,
    Database: process.env.DB_NAME,
  });

  createPool();

  try {
    const conn = await pool.getConnection();

    const [rows] = await conn.query("SELECT VERSION() AS version");

    console.log("✅ MySQL Connected");
    console.log("Version :", rows[0].version);

    conn.release();
  } catch (err) {
    console.error("\n==========================================");
    console.error("❌ GAGAL TERHUBUNG KE DATABASE");
    console.error("==========================================");

    console.error(err);

    process.exit(1);
  }
}

module.exports = {
  query,
  queryOne,
  insert,
  execute,
  transaction,
  initializeDatabase,
  getPool,
  safeInt,
};
