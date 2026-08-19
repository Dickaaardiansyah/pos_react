// tests/middleware/auth.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — middleware/auth.js: authenticate (verifikasi JWT + re-cek status
// akun ke DB tiap request) & authorize (pembatasan akses per role).
//
// req/res di-mock manual (bukan supertest) karena kita hanya menguji LOGIKA
// middleware secara terisolasi, bukan menjalankan server Express sungguhan.
// ─────────────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-secret-jangan-dipakai-di-produksi";

jest.mock("../../models/settingModel");

const jwt = require("jsonwebtoken");
const settingModel = require("../../models/settingModel");
const { authenticate, authorize } = require("../../middleware/auth");

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function signValidToken(payload = { id: 1, username: "kasir1", name: "Kasir Budi", role: "kasir" }) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("authenticate", () => {
  test("menolak request tanpa header Authorization", async () => {
    const req = { headers: {} };
    const next = jest.fn();
    await authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("menolak header yang bukan skema 'Bearer'", async () => {
    const req = { headers: { authorization: "Basic abc123" } };
    const next = jest.fn();
    await authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("menolak token yang tidak valid/rusak", async () => {
    const req = { headers: { authorization: "Bearer token-ngasal-rusak" } };
    const next = jest.fn();
    await authenticate(req, mockRes(), next);
    const errArg = next.mock.calls[0][0];
    expect(errArg.status).toBe(401);
    expect(errArg.message).toMatch(/tidak valid/);
  });

  test("menolak token yang sudah kedaluwarsa dengan pesan spesifik", async () => {
    const expiredToken = jwt.sign(
      { id: 1, username: "kasir1", role: "kasir" },
      process.env.JWT_SECRET,
      { expiresIn: -10 }, // langsung expired
    );
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const next = jest.fn();
    await authenticate(req, mockRes(), next);
    const errArg = next.mock.calls[0][0];
    expect(errArg.status).toBe(401);
    expect(errArg.message).toMatch(/Sesi login telah berakhir/);
  });

  test("menolak token valid milik user yang sudah dinonaktifkan admin", async () => {
    settingModel.findAuthStatusById.mockResolvedValueOnce({ role: "kasir", is_active: false });
    const req = { headers: { authorization: `Bearer ${signValidToken()}` } };
    const next = jest.fn();
    await authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, message: expect.stringContaining("dinonaktifkan") }),
    );
  });

  test("menolak token valid milik user yang sudah dihapus (tidak ditemukan di DB)", async () => {
    settingModel.findAuthStatusById.mockResolvedValueOnce(null);
    const req = { headers: { authorization: `Bearer ${signValidToken()}` } };
    const next = jest.fn();
    await authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("meloloskan token valid & mengisi req.user, dengan role SELALU dari DB terkini (bukan dari klaim token)", async () => {
    // Token diterbitkan saat user masih 'kasir', tapi sekarang sudah di-upgrade
    // jadi 'admin' oleh pihak lain — middleware harus pakai role TERBARU dari DB.
    settingModel.findAuthStatusById.mockResolvedValueOnce({ role: "admin", is_active: true });
    const req = { headers: { authorization: `Bearer ${signValidToken({ id: 1, username: "kasir1", name: "Kasir Budi", role: "kasir" })}` } };
    const next = jest.fn();

    await authenticate(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(); // dipanggil tanpa argumen error = lolos
    expect(req.user).toEqual({ id: 1, username: "kasir1", name: "Kasir Budi", role: "admin" });
  });
});

describe("authorize", () => {
  test("menolak jika req.user belum diisi (authenticate belum jalan/gagal)", () => {
    const req = {};
    const next = jest.fn();
    authorize("admin")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  test("menolak jika role user tidak termasuk daftar yang diizinkan", () => {
    const req = { user: { role: "kasir" } };
    const next = jest.fn();
    authorize("admin")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  test("meloloskan jika role user termasuk daftar yang diizinkan (multi-role)", () => {
    const req = { user: { role: "kasir" } };
    const next = jest.fn();
    authorize("admin", "kasir")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(); // lolos tanpa error
  });

  test("meloloskan admin pada route khusus admin", () => {
    const req = { user: { role: "admin" } };
    const next = jest.fn();
    authorize("admin")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});
