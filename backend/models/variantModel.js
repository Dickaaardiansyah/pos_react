// models/variantModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — varian produk (product_variants). Berbeda dari `units`,
// varian TIDAK punya master data bersama antar produk — setiap varian murni
// milik satu produk (mis. "Es" pada produk A tidak terhubung dengan "Es"
// pada produk B). Query mentah saja; aturan bisnis di services/productService.js.
// ─────────────────────────────────────────────────────────────────────────────
const { query, queryOne, insert, execute } = require("../config/database");

const variantModel = {
  findByProductId(productId) {
    return query(
      `SELECT id, product_id, name, price, price_wholesale, min_qty_wholesale, barcode, sku
       FROM product_variants WHERE product_id = ? ORDER BY id ASC`,
      [productId],
    );
  },

  // Dipakai saat scan barcode di kasir untuk langsung kena ke varian yang
  // barcode-nya cocok (mis. barcode kaleng "Kopi Susu Dingin" vs "Kopi Susu Panas").
  findByBarcode(barcode) {
    return queryOne(
      `SELECT id, product_id, name, price, price_wholesale, min_qty_wholesale, barcode, sku
       FROM product_variants WHERE barcode = ?`,
      [barcode],
    );
  },

  // Dipanggil dari dalam transaksi checkout (conn yang sama dengan
  // penguncian baris produk) supaya harga varian yang dipakai konsisten
  // dengan snapshot pada saat itu.
  findByIdForProduct(id, productId, conn) {
    const sql =
      "SELECT * FROM product_variants WHERE id = ? AND product_id = ?";
    if (conn)
      return conn
        .execute(sql, [id, productId])
        .then(([rows]) => rows[0] || null);
    return queryOne(sql, [id, productId]);
  },

  deleteByProductId(productId, conn) {
    const sql = "DELETE FROM product_variants WHERE product_id = ?";
    if (conn) return conn.execute(sql, [productId]);
    return query(sql, [productId]);
  },

  insertVariant(
    { productId, name, price, priceWholesale, minQtyWholesale, barcode, sku },
    conn,
  ) {
    const sql = `INSERT INTO product_variants
        (product_id, name, price, price_wholesale, min_qty_wholesale, barcode, sku)
       VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      productId,
      name,
      price,
      priceWholesale ?? null,
      minQtyWholesale ?? null,
      barcode || null,
      sku || null,
    ];
    if (conn) return conn.execute(sql, params);
    return insert(sql, params);
  },

  existsByBarcode(barcode, exceptId) {
    return exceptId
      ? queryOne(
          "SELECT id FROM product_variants WHERE barcode = ? AND id != ?",
          [barcode, exceptId],
        )
      : queryOne("SELECT id FROM product_variants WHERE barcode = ?", [
          barcode,
        ]);
  },

  delete(id) {
    return execute("DELETE FROM product_variants WHERE id = ?", [id]);
  },
};

module.exports = variantModel;
