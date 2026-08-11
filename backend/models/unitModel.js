// models/unitModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — satuan (units) master data. Query mentah saja; aturan bisnis
// (nama wajib, dsb.) hidup di services/unitService.js.
// ─────────────────────────────────────────────────────────────────────────────
const { query, queryOne, insert, execute } = require("../config/database");

const unitModel = {
  // product_count = berapa produk yang memakai satuan ini sebagai satuan
  // tambahan (product_units) ATAU sebagai satuan dasar (products.unit, teks
  // bebas) — dipakai UI kelola satuan untuk memberi peringatan sebelum hapus.
  findAll() {
    return query(
      `SELECT u.*,
              (SELECT COUNT(*) FROM product_units pu WHERE pu.unit_id = u.id) AS additional_usage_count,
              (SELECT COUNT(*) FROM products p WHERE p.unit = u.name AND p.is_active = 1) AS base_usage_count
       FROM units u ORDER BY u.name ASC`,
    );
  },

  findByName(name) {
    return queryOne("SELECT * FROM units WHERE name = ?", [name]);
  },

  findById(id) {
    return queryOne("SELECT * FROM units WHERE id = ?", [id]);
  },

  create(name) {
    return insert("INSERT INTO units (name) VALUES (?)", [name]);
  },

  // ─── Satuan tambahan per produk (konversi + harga per satuan) ──────────
  findByProductId(productId) {
    return query(
      `SELECT pu.id, pu.product_id, pu.unit_id, pu.conversion_qty,
              pu.price, pu.price_wholesale, pu.min_qty_wholesale, pu.purchase_only, u.name AS unit_name
       FROM product_units pu JOIN units u ON pu.unit_id = u.id
       WHERE pu.product_id = ? ORDER BY pu.id ASC`,
      [productId],
    );
  },

  deleteByProductId(productId, conn) {
    const sql = "DELETE FROM product_units WHERE product_id = ?";
    if (conn) return conn.execute(sql, [productId]);
    return query(sql, [productId]);
  },

  insertProductUnit(
    {
      productId,
      unitId,
      conversionQty,
      price,
      priceWholesale,
      minQtyWholesale,
      purchaseOnly,
    },
    conn,
  ) {
    const sql =
      "INSERT INTO product_units (product_id, unit_id, conversion_qty, price, price_wholesale, min_qty_wholesale, purchase_only) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const params = [
      productId,
      unitId,
      conversionQty,
      price ?? null,
      priceWholesale ?? null,
      minQtyWholesale ?? null,
      purchaseOnly ? 1 : 0,
    ];
    if (conn) return conn.execute(sql, params);
    return insert(sql, params);
  },

  delete(id) {
    return execute("DELETE FROM units WHERE id = ?", [id]);
  },
};

module.exports = unitModel;
