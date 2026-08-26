// tests/services/settingService/me.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — settingService.me (SATU FUNGSI SAJA)
// Validasi sesi saat refresh halaman: user harus ada & masih aktif.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-secret-jangan-dipakai-di-produksi";
process.env.JWT_EXPIRES_IN = "8h";

const bcrypt = require("bcryptjs");
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const { settingService } = require("../../../services/settingService");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase(); // seed admin(id1) + kasir(id2)
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

describe("settingService.me (validasi sesi saat refresh halaman)", () => {
  test("menolak jika user tidak ditemukan (mis. sudah dihapus / id salah)", async () => {
    await expect(settingService.me(999999)).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/tidak ditemukan/i),
    });
  });

  test("menolak jika akun sudah dinonaktifkan admin", async () => {
    const id = await insertUser({
      username: "kasir_nonaktif",
      isActive: 0,
    });
    await expect(settingService.me(id)).rejects.toThrow(/dinonaktifkan/i);
  });

  test("berhasil mengembalikan data user aktif (tanpa password)", async () => {
    const id = await insertUser({
      username: "kasir_aktif",
      name: "Kasir Budi",
      role: "cashier",
      isActive: 1,
    });
    const result = await settingService.me(id);
    expect(result).toMatchObject({
      id,
      name: "Kasir Budi",
      username: "kasir_aktif",
      role: "cashier",
    });
    expect(result.password).toBeUndefined();
  });

  test("user admin seed (id 1) dari resetDatabase bisa diload lewat me", async () => {
    const result = await settingService.me(1);
    expect(result).toMatchObject({
      id: 1,
      username: "admin_test",
      role: "admin",
    });
  });
});
