// tests/services/settingService/deleteUser.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — settingService.deleteUser (SATU FUNGSI SAJA)
// Soft-delete (deactivate) + guard minimal 1 admin aktif.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-secret-jangan-dipakai-di-produksi";
process.env.JWT_EXPIRES_IN = "8h";

const bcrypt = require("bcryptjs");
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const { settingService } = require("../../../services/settingService");
const {
  ValidationError,
  NotFoundError,
} = require("../../../services/productService");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase(); // admin(id1) + kasir(id2)
});

async function insertUser({
  username,
  password = bcrypt.hashSync("rahasia123", 10),
  name = "User Test",
  role = "cashier",
  isActive = 1,
}) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO users (name, username, password, role, is_active) VALUES (?, ?, ?, ?, ?)`,
    [name, username, password, role, isActive],
  );
  return result.insertId;
}

async function getUserRow(id) {
  const pool = getPool();
  const [[row]] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return row || null;
}

describe("settingService.deleteUser (deactivate)", () => {
  test("melempar NotFoundError jika user tidak ada", async () => {
    await expect(settingService.deleteUser(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("menolak menonaktifkan admin terakhir", async () => {
    await expect(settingService.deleteUser(1)).rejects.toThrow(
      /minimal 1 admin aktif/i,
    );

    const row = await getUserRow(1);
    expect(Number(row.is_active)).toBe(1);
    expect(row.role).toBe("admin");
  });

  test("mengizinkan menonaktifkan admin kalau masih ada admin aktif lain", async () => {
    const admin2Id = await insertUser({
      username: "admin_kedua",
      role: "admin",
      isActive: 1,
    });

    await settingService.deleteUser(admin2Id);

    const row = await getUserRow(admin2Id);
    expect(Number(row.is_active)).toBe(0);
    // baris tetap ada (soft delete)
    expect(row).not.toBeNull();
  });

  test("mengizinkan menonaktifkan cashier tanpa cek jumlah admin", async () => {
    const kasirId = await insertUser({
      username: "kasir_hapus",
      role: "cashier",
    });

    await settingService.deleteUser(kasirId);

    const row = await getUserRow(kasirId);
    expect(Number(row.is_active)).toBe(0);
  });

  test("kasir seed (id 2) bisa dinonaktifkan", async () => {
    await settingService.deleteUser(2);
    const row = await getUserRow(2);
    expect(Number(row.is_active)).toBe(0);
  });
});
