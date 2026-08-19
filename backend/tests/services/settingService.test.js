// tests/services/settingService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — settingService.login & me (autentikasi & sesi pengguna)
//
// bcrypt & jsonwebtoken TIDAK di-mock (dipakai apa adanya) supaya test ini
// benar-benar memverifikasi hash password & penandatanganan token bekerja,
// bukan cuma memverifikasi bahwa fungsinya "dipanggil". settingModel
// di-mock karena itu akses database.
// ─────────────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-secret-jangan-dipakai-di-produksi";
process.env.JWT_EXPIRES_IN = "8h";

jest.mock("../../models/settingModel");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const settingModel = require("../../models/settingModel");
const { settingService } = require("../../services/settingService");
const { ValidationError } = require("../../services/productService");

// Password uji: "rahasia123"
const BCRYPT_HASH = bcrypt.hashSync("rahasia123", 10);
// Format lama (pra-migrasi) — base64 polos, bukan bcrypt.
const LEGACY_BASE64 = Buffer.from("rahasia123").toString("base64");

beforeEach(() => {
  jest.clearAllMocks();
});

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

  test("menolak jika username tidak ditemukan (atau sudah nonaktif)", async () => {
    settingModel.findActiveUserByUsername.mockResolvedValueOnce(null);
    await expect(
      settingService.login({ username: "tidak_ada", password: "rahasia123" }),
    ).rejects.toMatchObject({ status: 401, message: "Username atau password salah" });
  });

  test("menolak jika password bcrypt salah", async () => {
    settingModel.findActiveUserByUsername.mockResolvedValueOnce({
      id: 1,
      username: "kasir1",
      name: "Kasir Budi",
      role: "kasir",
      password: BCRYPT_HASH,
    });
    await expect(
      settingService.login({ username: "kasir1", password: "password_salah" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test("pesan error login gagal SAMA untuk 'user tidak ada' dan 'password salah' (anti user-enumeration)", async () => {
    settingModel.findActiveUserByUsername.mockResolvedValueOnce(null);
    let err1;
    try {
      await settingService.login({ username: "x", password: "y" });
    } catch (e) {
      err1 = e;
    }

    settingModel.findActiveUserByUsername.mockResolvedValueOnce({
      id: 1,
      username: "kasir1",
      password: BCRYPT_HASH,
    });
    let err2;
    try {
      await settingService.login({ username: "kasir1", password: "salah" });
    } catch (e) {
      err2 = e;
    }

    expect(err1.message).toBe(err2.message);
  });

  test("berhasil login dengan password bcrypt yang benar: mengembalikan token JWT valid & data publik user", async () => {
    settingModel.findActiveUserByUsername.mockResolvedValueOnce({
      id: 1,
      username: "kasir1",
      name: "Kasir Budi",
      role: "kasir",
      password: BCRYPT_HASH,
    });

    const result = await settingService.login({
      username: "kasir1",
      password: "rahasia123",
    });

    expect(result.user).toEqual({
      id: 1,
      name: "Kasir Budi",
      username: "kasir1",
      role: "kasir",
    });
    // Password TIDAK pernah ikut ke response.
    expect(result.user.password).toBeUndefined();

    // Token benar-benar valid & bisa diverifikasi ulang.
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET);
    expect(decoded).toMatchObject({ id: 1, username: "kasir1", role: "kasir" });

    expect(settingModel.touchLastLogin).toHaveBeenCalledWith(1);
  });

  test("akun lama dengan password base64 masih bisa login (fallback kompatibilitas)", async () => {
    settingModel.findActiveUserByUsername.mockResolvedValueOnce({
      id: 2,
      username: "kasir_lama",
      name: "Kasir Lama",
      role: "kasir",
      password: LEGACY_BASE64,
    });

    const result = await settingService.login({
      username: "kasir_lama",
      password: "rahasia123",
    });
    expect(result.user.username).toBe("kasir_lama");
  });

  test("login sukses dengan password base64 lama memicu migrasi diam-diam ke bcrypt", async () => {
    settingModel.findActiveUserByUsername.mockResolvedValueOnce({
      id: 2,
      username: "kasir_lama",
      name: "Kasir Lama",
      role: "kasir",
      password: LEGACY_BASE64,
    });

    await settingService.login({ username: "kasir_lama", password: "rahasia123" });

    expect(settingModel.updateUser).toHaveBeenCalledTimes(1);
    const [, , patch] = settingModel.updateUser.mock.calls[0];
    // Password baru yang disimpan harus sudah berformat bcrypt, bukan base64 lagi.
    expect(patch.hashedPassword).toMatch(/^\$2[aby]\$/);
  });

  test("login sukses dengan password yang SUDAH bcrypt TIDAK memicu migrasi ulang", async () => {
    settingModel.findActiveUserByUsername.mockResolvedValueOnce({
      id: 1,
      username: "kasir1",
      name: "Kasir Budi",
      role: "kasir",
      password: BCRYPT_HASH,
    });
    await settingService.login({ username: "kasir1", password: "rahasia123" });
    expect(settingModel.updateUser).not.toHaveBeenCalled();
  });
});

describe("settingService.me (validasi sesi saat refresh halaman)", () => {
  test("menolak jika user tidak ditemukan (mis. sudah dihapus)", async () => {
    settingModel.findPublicUserById.mockResolvedValueOnce(null);
    await expect(settingService.me(999)).rejects.toMatchObject({ status: 401 });
  });

  test("menolak jika akun sudah dinonaktifkan admin", async () => {
    settingModel.findPublicUserById.mockResolvedValueOnce({
      id: 1,
      is_active: false,
    });
    await expect(settingService.me(1)).rejects.toThrow("dinonaktifkan");
  });

  test("berhasil mengembalikan data user aktif", async () => {
    settingModel.findPublicUserById.mockResolvedValueOnce({
      id: 1,
      name: "Kasir Budi",
      is_active: true,
    });
    const result = await settingService.me(1);
    expect(result.name).toBe("Kasir Budi");
  });
});
