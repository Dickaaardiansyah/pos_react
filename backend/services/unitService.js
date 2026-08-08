// services/unitService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — aturan bisnis satuan (units): nama wajib diisi. Kolom
// `name` bertipe UNIQUE dengan collation case-insensitive (utf8mb4_unicode_ci)
// sehingga "PCS" dan "pcs" otomatis dianggap satuan yang sama.
//
// createUnit() didesain idempotent (mengembalikan data yang sudah ada kalau
// sudah pernah dibuat) supaya kombobox "cari atau buat satuan baru" di form
// Produk/Kategori bisa langsung dipakai tanpa perlu cek dulu apakah satuan
// itu sudah ada.
// ─────────────────────────────────────────────────────────────────────────────
const unitModel = require("../models/unitModel");
const { queryOne } = require("../config/database");
const { ValidationError } = require("./productService");

const unitService = {
  listUnits() {
    return unitModel.findAll();
  },

  async createUnit({ name }) {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new ValidationError("Nama satuan wajib diisi");
    if (trimmed.length > 50)
      throw new ValidationError("Nama satuan maksimal 50 karakter");

    const existing = await unitModel.findByName(trimmed);
    if (existing) return existing;

    const result = await unitModel.create(trimmed);
    return unitModel.findById(result.insertId);
  },

  // Satuan tidak boleh dihapus kalau masih dipakai — baik sebagai satuan
  // tambahan (product_units, dijaga FK ON DELETE RESTRICT) maupun sebagai
  // satuan dasar produk (products.unit, kolom teks bebas sehingga tidak
  // dijaga FK — dicek manual di sini).
  async deleteUnit(id) {
    const unit = await unitModel.findById(id);
    if (!unit) throw new ValidationError("Satuan tidak ditemukan");

    const [additionalUsage, baseUsage] = await Promise.all([
      queryOne(
        "SELECT COUNT(*) AS total FROM product_units WHERE unit_id = ?",
        [id],
      ),
      queryOne(
        "SELECT COUNT(*) AS total FROM products WHERE unit = ? AND is_active = 1",
        [unit.name],
      ),
    ]);

    if (Number(additionalUsage.total) > 0 || Number(baseUsage.total) > 0) {
      throw new ValidationError(
        `Satuan "${unit.name}" masih dipakai oleh ${Number(additionalUsage.total) + Number(baseUsage.total)} produk, tidak bisa dihapus`,
      );
    }

    await unitModel.delete(id);
  },
};

module.exports = { unitService };
