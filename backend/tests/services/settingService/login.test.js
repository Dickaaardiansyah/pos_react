// tests/services/settingService/login.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — settingService.login (SATU FUNGSI SAJA)
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// bcrypt & jsonwebtoken dipakai apa adanya (bukan mock) supaya test ini
// benar-benar memverifikasi hash password & penandatanganan token bekerja.
// ─────────────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-secret-jangan-dipakai-di-produksi";
process.env.JWT_EXPIRES_IN = "8h";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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
  await resetDatabase(); // kosongkan semua tabel + seed user admin(id 1)/kasir(id 2) dasar
});

// Password uji: "rahasia123"
const BCRYPT_HASH = bcrypt.hashSync("rahasia123", 10);
// Format lama (pra-migrasi) — base64 polos, bukan bcrypt.
const LEGACY_BASE64 = Buffer.from("rahasia123").toString("base64");

async function insertUser({
  username,
  password,
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

describe("settingService.login", () => {
  test("menolak jika username kosong", async () => {
    await expect(
      settingService.login({ username: "", password: "rahasia123" }),
    ).rejects.toThrow(ValidationError);
  });

  test("menolak jika password kosong", async () => {
    await expect(
      settingService.login({ username: "kasir1", password: "" }),
    ).rejects.toThrow("Username dan password wajib diisi");
  });

  test("menolak jika username tidak ditemukan", async () => {
    await expect(
      settingService.login({ username: "tidak_ada", password: "rahasia123" }),
    ).rejects.toMatchObject({
      status: 401,
      message: "Username atau password salah",
    });
  });

  test("menolak jika username ada tapi sudah nonaktif", async () => {
    await insertUser({
      username: "kasir_nonaktif",
      password: BCRYPT_HASH,
      isActive: 0,
    });
    await expect(
      settingService.login({
        username: "kasir_nonaktif",
        password: "rahasia123",
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test("menolak jika password bcrypt salah", async () => {
    await insertUser({ username: "kasir1", password: BCRYPT_HASH });
    await expect(
      settingService.login({ username: "kasir1", password: "password_salah" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test("pesan error login gagal SAMA untuk 'user tidak ada' dan 'password salah' (anti user-enumeration)", async () => {
    let err1;
    try {
      await settingService.login({ username: "x_tidak_ada", password: "y" });
    } catch (e) {
      err1 = e;
    }

    await insertUser({ username: "kasir1", password: BCRYPT_HASH });
    let err2;
    try {
      await settingService.login({ username: "kasir1", password: "salah" });
    } catch (e) {
      err2 = e;
    }

    expect(err1.message).toBe(err2.message);
  });

  test("berhasil login dengan password bcrypt yang benar: mengembalikan token JWT valid & data publik user", async () => {
    const userId = await insertUser({
      username: "kasir1",
      password: BCRYPT_HASH,
      name: "Kasir Budi",
      role: "cashier",
    });

    const result = await settingService.login({
      username: "kasir1",
      password: "rahasia123",
    });

    expect(result.user).toEqual({
      id: userId,
      name: "Kasir Budi",
      username: "kasir1",
      role: "cashier",
    });
    // Password TIDAK pernah ikut ke response.
    expect(result.user.password).toBeUndefined();

    // Token benar-benar valid & bisa diverifikasi ulang.
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET);
    expect(decoded).toMatchObject({
      id: userId,
      username: "kasir1",
      role: "cashier",
    });

    // last_login sungguhan ter-update di database.
    const pool = getPool();
    const [[row]] = await pool.query(
      "SELECT last_login FROM users WHERE id = ?",
      [userId],
    );
    expect(row.last_login).not.toBeNull();
  });

  test("akun lama dengan password base64 masih bisa login (fallback kompatibilitas)", async () => {
    await insertUser({
      username: "kasir_lama",
      password: LEGACY_BASE64,
      name: "Kasir Lama",
    });

    const result = await settingService.login({
      username: "kasir_lama",
      password: "rahasia123",
    });
    expect(result.user.username).toBe("kasir_lama");
  });

  test("login sukses dengan password base64 lama memicu migrasi diam-diam ke bcrypt", async () => {
    const userId = await insertUser({
      username: "kasir_lama",
      password: LEGACY_BASE64,
    });

    await settingService.login({
      username: "kasir_lama",
      password: "rahasia123",
    });

    const pool = getPool();
    const [[row]] = await pool.query(
      "SELECT password FROM users WHERE id = ?",
      [userId],
    );
    // Password yang tersimpan sekarang harus sudah berformat bcrypt, bukan base64 lagi.
    expect(row.password).toMatch(/^\$2[aby]\$/);
  });

  test("login sukses dengan password yang SUDAH bcrypt TIDAK memicu migrasi ulang (hash tidak berubah)", async () => {
    const userId = await insertUser({
      username: "kasir1",
      password: BCRYPT_HASH,
    });
    await settingService.login({ username: "kasir1", password: "rahasia123" });

    const pool = getPool();
    const [[row]] = await pool.query(
      "SELECT password FROM users WHERE id = ?",
      [userId],
    );
    expect(row.password).toBe(BCRYPT_HASH);
  });
});
