// services/settingService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — pengaturan toko, autentikasi, manajemen user, dan ekspor CSV.
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const settingModel = require("../models/settingModel");
const { ValidationError, NotFoundError } = require("./productService");

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.status = 401;
  }
}

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

// Password lama (sebelum migrasi ke bcrypt) disimpan sebagai base64 polos —
// bcrypt hash selalu diawali "$2a$"/"$2b$"/"$2y$", base64 tidak pernah begitu,
// jadi keduanya bisa dibedakan dengan aman.
function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$/.test(value);
}

function verifyPassword(plain, stored) {
  if (isBcryptHash(stored)) return bcrypt.compareSync(plain, stored);
  // Fallback untuk akun lama yang password-nya masih base64.
  return Buffer.from(plain).toString("base64") === stored;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" },
  );
}

function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val == null) return "";
    const str = String(val);
    return str.includes(",") || str.includes('"')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

const settingService = {
  async getAllSettings() {
    const rows = await settingModel.findAllSettings();
    const settings = {};
    rows.forEach((r) => {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch {
        settings[r.key] = r.value;
      }
    });
    return settings;
  },

  async updateSettings(body) {
    for (const [key, value] of Object.entries(body)) {
      const val =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      await settingModel.upsertSetting(key, val);
    }
  },

  listUsers() {
    return settingModel.findAllUsers();
  },

  async createUser({ name, username, password, role }) {
    if (!name || !username || !password)
      throw new ValidationError("Nama, username, dan password wajib diisi");
    const existing = await settingModel.findUserByUsername(username);
    if (existing) throw new ValidationError("Username sudah digunakan");
    const result = await settingModel.createUser({
      name,
      username,
      hashedPassword: hashPassword(password),
      role,
    });
    return settingModel.findPublicUserById(result.insertId);
  },

  async updateUser(id, { name, role, is_active, password }) {
    const existing = await settingModel.findUserById(id);
    if (!existing) throw new NotFoundError("User tidak ditemukan");
    await settingModel.updateUser(id, existing, {
      name,
      role,
      isActive: is_active,
      hashedPassword: password ? hashPassword(password) : undefined,
    });
    return settingModel.findPublicUserById(id);
  },

  async deleteUser(id) {
    const user = await settingModel.findUserById(id);
    if (!user) throw new NotFoundError("User tidak ditemukan");
    await settingModel.deactivateUser(id);
  },

  async login({ username, password }) {
    if (!username || !password)
      throw new ValidationError("Username dan password wajib diisi");
    const user = await settingModel.findActiveUserByUsername(username);
    if (!user || !verifyPassword(password, user.password)) {
      throw new UnauthorizedError("Username atau password salah");
    }

    // Migrasi diam-diam: akun lama dengan password base64 otomatis
    // di-upgrade ke bcrypt begitu berhasil login.
    if (!isBcryptHash(user.password)) {
      await settingModel.updateUser(user.id, user, {
        hashedPassword: hashPassword(password),
      });
    }

    await settingModel.touchLastLogin(user.id);
    const publicUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    };
    const token = signToken(publicUser);
    return { token, user: publicUser };
  },

  async me(userId) {
    const user = await settingModel.findPublicUserById(userId);
    if (!user) throw new UnauthorizedError("Pengguna tidak ditemukan");
    return user;
  },

  async exportTransactionsCSV(startDate, endDate) {
    const rows = await settingModel.findTransactionsForExport(
      startDate ||
        new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
      endDate || new Date().toISOString().split("T")[0],
    );
    if (!rows.length) throw new NotFoundError("Tidak ada data untuk diekspor");
    return toCSV(rows);
  },

  async exportProductsCSV() {
    const rows = await settingModel.findProductsForExport();
    return toCSV(rows);
  },
};

module.exports = { settingService, UnauthorizedError };
