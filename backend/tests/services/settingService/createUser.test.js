// tests/services/settingService/createUser.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — settingService.createUser (SATU FUNGSI SAJA)
// Validasi input, password policy, uniqueness username, hash bcrypt di DB.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-secret-jangan-dipakai-di-produksi";
process.env.JWT_EXPIRES_IN = "8h";

const bcrypt = require("bcryptjs");
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const { settingService } = require("../../../services/settingService");
const { ValidationError } = require("../../../services/productService");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

async function findUserRowByUsername(username) {
  const pool = getPool();
  const [[row]] = await pool.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
  );
  return row || null;
}

describe("settingService.createUser", () => {
  test("menolak jika nama/username/password kosong", async () => {
    await expect(
      settingService.createUser({
        name: "",
        username: "kasir2",
        password: "delapan8",
        role: "cashier",
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      settingService.createUser({
        name: "Kasir",
        username: "",
        password: "delapan8",
        role: "cashier",
      }),
    ).rejects.toThrow("Nama, username, dan password wajib diisi");
  });

  test("menolak password kurang dari 8 karakter", async () => {
    await expect(
      settingService.createUser({
        name: "Kasir Baru",
        username: "kasir2",
        password: "abc123",
        role: "cashier",
      }),
    ).rejects.toThrow("Password minimal 8 karakter");

    const row = await findUserRowByUsername("kasir2");
    expect(row).toBeNull(); // tidak tersimpan
  });

  test("mengizinkan password tepat 8 karakter & menyimpan hash bcrypt", async () => {
    const result = await settingService.createUser({
      name: "Kasir Baru",
      username: "kasir2",
      password: "delapan8",
      role: "cashier",
    });

    expect(result).toMatchObject({
      name: "Kasir Baru",
      username: "kasir2",
      role: "cashier",
    });
    expect(result.password).toBeUndefined(); // public user, tanpa password

    const row = await findUserRowByUsername("kasir2");
    expect(row).not.toBeNull();
    expect(row.password).toMatch(/^\$2[aby]\$/);
    expect(bcrypt.compareSync("delapan8", row.password)).toBe(true);
    expect(Number(row.is_active)).toBe(1);
  });

  test("menolak username yang sudah dipakai", async () => {
    await settingService.createUser({
      name: "Pertama",
      username: "unik_user",
      password: "delapan8",
      role: "cashier",
    });

    await expect(
      settingService.createUser({
        name: "Kedua",
        username: "unik_user",
        password: "delapan99",
        role: "cashier",
      }),
    ).rejects.toThrow("Username sudah digunakan");
  });

  test("bisa membuat user role admin", async () => {
    const result = await settingService.createUser({
      name: "Admin Dua",
      username: "admin2",
      password: "adminpass1",
      role: "admin",
    });
    expect(result.role).toBe("admin");

    const row = await findUserRowByUsername("admin2");
    expect(row.role).toBe("admin");
  });
});
