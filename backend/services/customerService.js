// services/customerService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — aturan bisnis modul Pelanggan: validasi input & nomor telepon
// unik. Bisa diakses kasir maupun admin (lihat routes/customer.routes.js).
// ─────────────────────────────────────────────────────────────────────────────
const customerModel = require("../models/customerModel");
const { ValidationError, NotFoundError } = require("./productService");

const customerService = {
  list({ search, page, limit }) {
    if (!limit) return customerModel.findAll({ search });
    const parsedLimit = parseInt(limit) || 20;
    const parsedPage = parseInt(page) || 1;
    return customerModel.findAll({
      search,
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit,
    });
  },

  async getById(id) {
    const customer = await customerModel.findById(id);
    if (!customer) throw new NotFoundError("Pelanggan tidak ditemukan");
    return customer;
  },

  async create(payload) {
    const { name, phone } = payload;
    if (!name || !name.trim())
      throw new ValidationError("Nama pelanggan wajib diisi");
    if (phone) {
      const existing = await customerModel.findByPhone(phone);
      if (existing)
        throw new ValidationError(
          "Nomor telepon sudah terdaftar untuk pelanggan lain",
        );
    }
    const result = await customerModel.create(payload);
    return customerModel.findById(result.insertId);
  },

  async update(id, payload) {
    const existing = await customerModel.findById(id);
    if (!existing) throw new NotFoundError("Pelanggan tidak ditemukan");
    const { name, phone } = payload;
    if (!name || !name.trim())
      throw new ValidationError("Nama pelanggan wajib diisi");
    if (phone) {
      const dup = await customerModel.findByPhone(phone);
      if (dup && dup.id !== Number(id)) {
        throw new ValidationError(
          "Nomor telepon sudah terdaftar untuk pelanggan lain",
        );
      }
    }
    await customerModel.update(id, payload);
    return customerModel.findById(id);
  },

  async remove(id) {
    const existing = await customerModel.findById(id);
    if (!existing) throw new NotFoundError("Pelanggan tidak ditemukan");
    await customerModel.deactivate(id);
  },
};

module.exports = customerService;
