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
    ).rejects.toMatchObject({
      status: 401,
      message: "Username atau password salah",
    });
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

    await settingService.login({
      username: "kasir_lama",
      password: "rahasia123",
    });

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

// FIX (revisi dosen #12): admin dapat mengunci dirinya sendiri / admin
// terakhir — updateUser (ganti role/nonaktifkan) dan deleteUser
// (deactivateUser) sekarang wajib memastikan sistem masih punya minimal
// 1 admin aktif setelah operasinya dijalankan.
describe("settingService.createUser — password policy", () => {
  test("menolak password kurang dari 8 karakter", async () => {
    await expect(
      settingService.createUser({
        name: "Kasir Baru",
        username: "kasir2",
        password: "abc123",
        role: "cashier",
      }),
    ).rejects.toThrow("Password minimal 8 karakter");
    expect(settingModel.createUser).not.toHaveBeenCalled();
  });

  test("mengizinkan password tepat 8 karakter", async () => {
    settingModel.findUserByUsername.mockResolvedValueOnce(null);
    settingModel.createUser.mockResolvedValueOnce({ insertId: 5 });
    settingModel.findPublicUserById.mockResolvedValueOnce({
      id: 5,
      name: "Kasir Baru",
      username: "kasir2",
      role: "cashier",
    });

    const result = await settingService.createUser({
      name: "Kasir Baru",
      username: "kasir2",
      password: "delapan8",
      role: "cashier",
    });

    expect(result.username).toBe("kasir2");
    expect(settingModel.createUser).toHaveBeenCalled();
  });
});

describe("settingService.updateUser — password policy", () => {
  test("menolak password baru kurang dari 8 karakter", async () => {
    settingModel.findUserById.mockResolvedValueOnce({
      id: 2,
      name: "Kasir Budi",
      role: "cashier",
      is_active: 1,
      password: "hash",
    });

    await expect(
      settingService.updateUser(2, { password: "short1" }),
    ).rejects.toThrow("Password minimal 8 karakter");
    expect(settingModel.updateUser).not.toHaveBeenCalled();
  });

  test("mengizinkan update tanpa mengganti password (field password tidak dikirim)", async () => {
    settingModel.findUserById.mockResolvedValueOnce({
      id: 2,
      name: "Kasir Budi",
      role: "cashier",
      is_active: 1,
      password: "hash",
    });
    settingModel.findPublicUserById.mockResolvedValueOnce({
      id: 2,
      name: "Kasir Budi Santoso",
      role: "cashier",
      is_active: 1,
    });

    const result = await settingService.updateUser(2, {
      name: "Kasir Budi Santoso",
    });

    expect(result.name).toBe("Kasir Budi Santoso");
    expect(settingModel.updateUser).toHaveBeenCalled();
  });
});

describe("settingService.updateUser — guard admin aktif minimal 1", () => {
  test("menolak kalau admin SATU-SATUNYA mengubah role dirinya sendiri jadi cashier", async () => {
    settingModel.findUserById.mockResolvedValueOnce({
      id: 1,
      name: "Admin Utama",
      role: "admin",
      is_active: 1,
      password: "hash",
    });
    // Tidak ada admin aktif lain selain dirinya (excludeId=1 -> count 0).
    settingModel.countActiveAdmins.mockResolvedValueOnce({ count: 0 });

    await expect(
      settingService.updateUser(1, { role: "cashier" }),
    ).rejects.toThrow(ValidationError);
    expect(settingModel.updateUser).not.toHaveBeenCalled();
  });

  test("menolak kalau admin SATU-SATUNYA menonaktifkan dirinya sendiri lewat updateUser", async () => {
    settingModel.findUserById.mockResolvedValueOnce({
      id: 1,
      name: "Admin Utama",
      role: "admin",
      is_active: 1,
      password: "hash",
    });
    settingModel.countActiveAdmins.mockResolvedValueOnce({ count: 0 });

    await expect(
      settingService.updateUser(1, { is_active: false }),
    ).rejects.toThrow("minimal 1 admin aktif");
  });

  test("mengizinkan admin terakhir mengubah namanya sendiri (tetap admin aktif)", async () => {
    settingModel.findUserById.mockResolvedValueOnce({
      id: 1,
      name: "Admin Lama",
      role: "admin",
      is_active: 1,
      password: "hash",
    });
    settingModel.findPublicUserById.mockResolvedValueOnce({
      id: 1,
      name: "Admin Baru",
      role: "admin",
      is_active: 1,
    });

    const result = await settingService.updateUser(1, { name: "Admin Baru" });

    expect(result.name).toBe("Admin Baru");
    // Tetap admin aktif → tidak perlu cek jumlah admin lain sama sekali.
    expect(settingModel.countActiveAdmins).not.toHaveBeenCalled();
    expect(settingModel.updateUser).toHaveBeenCalled();
  });

  test("mengizinkan downgrade admin kalau masih ada admin aktif lain", async () => {
    settingModel.findUserById.mockResolvedValueOnce({
      id: 2,
      name: "Admin Kedua",
      role: "admin",
      is_active: 1,
      password: "hash",
    });
    // Ada 1 admin aktif lain selain id=2.
    settingModel.countActiveAdmins.mockResolvedValueOnce({ count: 1 });
    settingModel.findPublicUserById.mockResolvedValueOnce({
      id: 2,
      name: "Admin Kedua",
      role: "cashier",
      is_active: 1,
    });

    const result = await settingService.updateUser(2, { role: "cashier" });
    expect(result.role).toBe("cashier");
  });

  test("tidak perlu cek jumlah admin kalau user yang diubah bukan admin aktif (mis. cashier)", async () => {
    settingModel.findUserById.mockResolvedValueOnce({
      id: 3,
      name: "Kasir Budi",
      role: "cashier",
      is_active: 1,
      password: "hash",
    });
    settingModel.findPublicUserById.mockResolvedValueOnce({
      id: 3,
      name: "Kasir Budi",
      role: "cashier",
      is_active: 0,
    });

    await settingService.updateUser(3, { is_active: false });
    expect(settingModel.countActiveAdmins).not.toHaveBeenCalled();
  });
});

describe("settingService.deleteUser — guard admin aktif minimal 1", () => {
  test("menolak menonaktifkan admin terakhir", async () => {
    settingModel.findUserById.mockResolvedValueOnce({
      id: 1,
      role: "admin",
      is_active: 1,
    });
    settingModel.countActiveAdmins.mockResolvedValueOnce({ count: 0 });

    await expect(settingService.deleteUser(1)).rejects.toThrow(
      "minimal 1 admin aktif",
    );
    expect(settingModel.deactivateUser).not.toHaveBeenCalled();
  });

  test("mengizinkan menonaktifkan admin kalau masih ada admin aktif lain", async () => {
    settingModel.findUserById.mockResolvedValueOnce({
      id: 2,
      role: "admin",
      is_active: 1,
    });
    settingModel.countActiveAdmins.mockResolvedValueOnce({ count: 1 });

    await settingService.deleteUser(2);
    expect(settingModel.deactivateUser).toHaveBeenCalledWith(2);
  });

  test("mengizinkan menonaktifkan cashier tanpa cek jumlah admin", async () => {
    settingModel.findUserById.mockResolvedValueOnce({
      id: 3,
      role: "cashier",
      is_active: 1,
    });

    await settingService.deleteUser(3);
    expect(settingModel.countActiveAdmins).not.toHaveBeenCalled();
    expect(settingModel.deactivateUser).toHaveBeenCalledWith(3);
  });
});
