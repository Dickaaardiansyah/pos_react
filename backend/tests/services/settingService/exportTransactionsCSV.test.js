// tests/services/settingService/exportTransactionsCSV.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — settingService.exportTransactionsCSV (SATU FUNGSI SAJA)
// NotFound jika tidak ada transaksi di range; CSV jika ada data.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const {
  settingService,
} = require("../../../services/settingService");
const { NotFoundError } = require("../../../services/productService");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

/**
 * Insert transaksi minimal agar export punya baris.
 * Kolom menyesuaikan schema transactions (dari schema-dump / model).
 */
async function insertMinimalTransaction(overrides = {}) {
  const pool = getPool();
  // Cek kolom yang ada supaya insert tidak gagal di schema yang sedikit beda
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'`,
  );
  const colSet = new Set(cols.map((c) => c.COLUMN_NAME));

  const code =
    overrides.code ||
    `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const fields = [];
  const values = [];
  const placeholders = [];

  function add(col, val) {
    if (colSet.has(col)) {
      fields.push(col);
      values.push(val);
      placeholders.push("?");
    }
  }

  add("transaction_code", code);
  add("user_id", 1);
  add("cashier_name", "Admin Test");
  add("customer_name", overrides.customer || "Umum");
  add("total_amount", overrides.total ?? 10000);
  add("discount_amount", 0);
  add("final_amount", overrides.total ?? 10000);
  add("payment_method", "cash");
  add("payment_amount", overrides.total ?? 10000);
  add("change_amount", 0);
  add("status", "completed");
  add("created_at", overrides.createdAt || new Date());

  if (!fields.length) {
    throw new Error("Tabel transactions tidak punya kolom yang dikenali");
  }

  const [result] = await pool.query(
    `INSERT INTO transactions (${fields.join(",")}) VALUES (${placeholders.join(",")})`,
    values,
  );
  return result.insertId;
}

describe("settingService.exportTransactionsCSV", () => {
  test("tidak ada transaksi di range: melempar NotFoundError", async () => {
    await expect(
      settingService.exportTransactionsCSV("2020-01-01", "2020-01-31"),
    ).rejects.toThrow(NotFoundError);
    await expect(
      settingService.exportTransactionsCSV("2020-01-01", "2020-01-31"),
    ).rejects.toThrow("Tidak ada data untuk diekspor");
  });

  test("ada transaksi di range: mengembalikan CSV dengan header & data", async () => {
    const today = new Date();
    const ymd = today.toISOString().split("T")[0];

    await insertMinimalTransaction({
      code: "TRX-EXPORT-1",
      total: 25000,
      customer: "Budi",
      createdAt: today,
    });

    const csv = await settingService.exportTransactionsCSV(ymd, ymd);
    expect(typeof csv).toBe("string");
    expect(csv.length).toBeGreaterThan(0);

    const lines = csv.split("\n");
    expect(lines[0]).toContain("Kode Transaksi");
    expect(csv).toContain("TRX-EXPORT-1");
    expect(csv).toContain("Budi");
  });

  test("tanpa argumen tanggal: pakai default 30 hari terakhir (tidak error jika kosong → NotFound)", async () => {
    // DB kosong setelah reset → NotFound
    await expect(settingService.exportTransactionsCSV()).rejects.toThrow(
      NotFoundError,
    );
  });
});
