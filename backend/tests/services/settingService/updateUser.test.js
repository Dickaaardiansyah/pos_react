// tests/services/settingService/updateUser.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — settingService.updateUser (SATU FUNGSI SAJA)
// Password policy + guard minimal 1 admin aktif + update name/role/is_active.
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

describe("settingService.updateUser — password policy", () => {
  test("menolak password baru kurang dari 8 karakter", async () => {
    const id = await insertUser({ username: "kasir_upd" });
    await expect(
      settingService.updateUser(id, { password: "short1" }),
    ).rejects.toThrow("Password minimal 8 karakter");

    const row = await getUserRow(id);
    // password lama tidak berubah
    expect(bcrypt.compareSync("rahasia123", row.password)).toBe(true);
  });

  test("mengizinkan update tanpa mengganti password (field password tidak dikirim)", async () => {
    const id = await insertUser({
      username: "kasir_nama",
      name: "Kasir Budi",
    });
    const before = await getUserRow(id);

    const result = await settingService.updateUser(id, {
      name: "Kasir Budi Santoso",
    });
    expect(result.name).toBe("Kasir Budi Santoso");

    const after = await getUserRow(id);
    expect(after.password).toBe(before.password);
    expect(after.name).toBe("Kasir Budi Santoso");
  });

  test("berhasil ganti password: hash baru tersimpan di DB", async () => {
    const id = await insertUser({ username: "kasir_pwd" });
    await settingService.updateUser(id, { password: "passwordbaru9" });

    const row = await getUserRow(id);
    expect(row.password).toMatch(/^\$2[aby]\$/);
    expect(bcrypt.compareSync("passwordbaru9", row.password)).toBe(true);
    expect(bcrypt.compareSync("rahasia123", row.password)).toBe(false);
  });
});

describe("settingService.updateUser — guard admin aktif minimal 1", () => {
  test("melempar NotFoundError jika user tidak ada", async () => {
    await expect(
      settingService.updateUser(999999, { name: "X" }),
    ).rejects.toThrow(NotFoundError);
  });

  test("menolak kalau admin SATU-SATUNYA mengubah role dirinya sendiri jadi cashier", async () => {
    // resetDatabase hanya seed 1 admin (id=1). Nonaktifkan/hapus bukan opsi —
    // pastikan tidak ada admin lain.
    await expect(
      settingService.updateUser(1, { role: "cashier" }),
    ).rejects.toThrow(ValidationError);

    const row = await getUserRow(1);
    expect(row.role).toBe("admin");
  });

  test("menolak kalau admin SATU-SATUNYA menonaktifkan dirinya sendiri lewat updateUser", async () => {
    await expect(
      settingService.updateUser(1, { is_active: false }),
    ).rejects.toThrow(/minimal 1 admin aktif/i);

    const row = await getUserRow(1);
    expect(Number(row.is_active)).toBe(1);
  });

  test("mengizinkan admin terakhir mengubah namanya sendiri (tetap admin aktif)", async () => {
    const result = await settingService.updateUser(1, {
      name: "Admin Baru",
    });
    expect(result.name).toBe("Admin Baru");
    expect(result.role).toBe("admin");

    const row = await getUserRow(1);
    expect(row.name).toBe("Admin Baru");
    expect(row.role).toBe("admin");
    expect(Number(row.is_active)).toBe(1);
  });

  test("mengizinkan downgrade admin kalau masih ada admin aktif lain", async () => {
    const admin2Id = await insertUser({
      username: "admin_kedua",
      name: "Admin Kedua",
      role: "admin",
      isActive: 1,
    });

    const result = await settingService.updateUser(admin2Id, {
      role: "cashier",
    });
    expect(result.role).toBe("cashier");

    const row = await getUserRow(admin2Id);
    expect(row.role).toBe("cashier");
    // admin id=1 tetap admin
    const admin1 = await getUserRow(1);
    expect(admin1.role).toBe("admin");
  });

  test("tidak perlu cek jumlah admin kalau user yang diubah bukan admin aktif (mis. cashier)", async () => {
    const kasirId = await insertUser({
      username: "kasir_nonaktifkan",
      role: "cashier",
    });

    const result = await settingService.updateUser(kasirId, {
      is_active: false,
    });
    // response public — is_active bisa 0 / false tergantung model
    expect(Number(result.is_active) === 0 || result.is_active === false).toBe(
      true,
    );

    const row = await getUserRow(kasirId);
    expect(Number(row.is_active)).toBe(0);
  });
});
