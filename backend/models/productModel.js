// models/productModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — satu-satunya lapisan yang boleh menyentuh SQL untuk domain
// "produk" & "kategori". Tidak ada logika bisnis di sini, murni akses data.
// ─────────────────────────────────────────────────────────────────────────────
const {
  query,
  queryOne,
  insert,
  execute,
  safeInt,
  transaction,
} = require("../config/database");

const productModel = {
  findAll({ categoryId, search, lowStockOnly } = {}) {
    let sql = `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    const params = [];

    if (categoryId) {
      sql += " AND p.category_id = ?";
      params.push(categoryId);
    }
    if (search) {
      sql += " AND (p.name LIKE ? OR p.barcode LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (lowStockOnly) sql += " AND p.stock <= p.min_stock";

    sql += " ORDER BY p.name ASC";
    return query(sql, params);
  },

  findByBarcode(barcode) {
    return queryOne(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.barcode = ? AND p.is_active = 1`,
      [barcode],
    );
  },

  findById(id) {
    return queryOne(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id],
    );
  },

  findByIdRaw(id) {
    return queryOne("SELECT * FROM products WHERE id = ?", [id]);
  },

  existsByBarcode(barcode) {
    return queryOne("SELECT id FROM products WHERE barcode = ?", [barcode]);
  },

  create({
    barcode,
    name,
    description,
    categoryId,
    price,
    priceWholesale,
    minQtyWholesale,
    costPrice,
    stock,
    minStock,
    leadTimeValue,
    safetyStockValue,
    ropTimeUnit,
    unit,
  }) {
    return insert(
      `INSERT INTO products
        (barcode, name, description, category_id, price, price_wholesale, min_qty_wholesale, cost_price, stock, min_stock, lead_time_value, safety_stock_value, rop_time_unit, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        barcode,
        name,
        description || "",
        categoryId || null,
        price,
        priceWholesale || null,
        minQtyWholesale || null,
        costPrice || 0,
        stock || 0,
        minStock || 5,
        leadTimeValue === undefined ||
        leadTimeValue === null ||
        leadTimeValue === ""
          ? null
          : leadTimeValue,
        safetyStockValue === undefined ||
        safetyStockValue === null ||
        safetyStockValue === ""
          ? null
          : safetyStockValue,
        ropTimeUnit === "jam" ? "jam" : "hari",
        unit || "pcs",
      ],
    );
  },

  update(id, existing, patch) {
    return execute(
      `UPDATE products
       SET barcode=?, name=?, description=?, category_id=?, price=?, price_wholesale=?, min_qty_wholesale=?, cost_price=?, min_stock=?, lead_time_value=?, safety_stock_value=?, rop_time_unit=?, unit=?, is_active=?
       WHERE id=?`,
      [
        patch.barcode ?? existing.barcode,
        patch.name ?? existing.name,
        patch.description ?? existing.description,
        patch.categoryId !== undefined
          ? patch.categoryId
          : existing.category_id,
        patch.price ?? existing.price,
        patch.priceWholesale !== undefined
          ? patch.priceWholesale
          : existing.price_wholesale,
        patch.minQtyWholesale !== undefined
          ? patch.minQtyWholesale
          : existing.min_qty_wholesale,
        patch.costPrice ?? existing.cost_price,
        patch.minStock ?? existing.min_stock,
        patch.leadTimeValue !== undefined
          ? patch.leadTimeValue === "" || patch.leadTimeValue === null
            ? null
            : patch.leadTimeValue
          : existing.lead_time_value,
        patch.safetyStockValue !== undefined
          ? patch.safetyStockValue === "" || patch.safetyStockValue === null
            ? null
            : patch.safetyStockValue
          : existing.safety_stock_value,
        patch.ropTimeUnit !== undefined
          ? patch.ropTimeUnit === "jam"
            ? "jam"
            : "hari"
          : existing.rop_time_unit,
        patch.unit ?? existing.unit,
        patch.isActive !== undefined ? patch.isActive : existing.is_active,
        id,
      ],
    );
  },

  // Dipertahankan untuk kompatibilitas, tapi TIDAK dipakai lagi oleh alur
  // updateStock manual (lihat updateStockAtomic) karena rawan lost update:
  // dipanggil tanpa transaction/lock, jadi hasil hitung dari baca stock
  // lama bisa menimpa perubahan stok dari transaksi lain yang selesai di
  // antara SELECT dan UPDATE ini.
  updateStockValue(id, newStock) {
    return execute("UPDATE products SET stock = ? WHERE id = ?", [
      newStock,
      id,
    ]);
  },

  // ─── Penyesuaian stok manual (adjustment/in/out dari admin) ────────────
  // Mengunci baris produk dengan SELECT ... FOR UPDATE di dalam transaction
  // yang sama sebelum menghitung & menulis stok baru — pola yang sama
  // dengan purchaseModel.createPurchase — supaya penjualan/pembelian yang
  // terjadi bersamaan pada produk yang sama tidak bisa saling menimpa
  // (lost update). `computeNewStock(product)` menerima baris produk hasil
  // lock (stock TERBARU, bukan stock yang dibaca sebelum request masuk)
  // dan harus mengembalikan { newStock, historyType, historyQuantity, reference }
  // atau melempar error (mis. stok tidak cukup) — error tsb otomatis
  // membatalkan transaction (rollback) karena dilempar dari dalam callback.
  updateStockAtomic(id, computeNewStock, { notes, createdBy } = {}) {
    return transaction(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT * FROM products WHERE id = ? FOR UPDATE",
        [id],
      );
      const product = rows[0];
      if (!product) {
        const err = new Error("Produk tidak ditemukan");
        err.status = 404;
        throw err;
      }

      const { newStock, historyType, historyQuantity, reference } =
        computeNewStock(product);

      await conn.execute("UPDATE products SET stock = ? WHERE id = ?", [
        newStock,
        id,
      ]);

      await conn.execute(
        `INSERT INTO stock_history
          (product_id, type, quantity, previous_stock, new_stock, reference, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          historyType,
          historyQuantity,
          product.stock,
          newStock,
          reference || "manual",
          notes || "",
          createdBy || "",
        ],
      );

      return { ...product, stock: newStock };
    });
  },

  softDelete(id) {
    return execute("UPDATE products SET is_active = 0 WHERE id = ?", [id]);
  },

  // ─── Stock history ──────────────────────────────────────────────────────
  addStockHistory({
    productId,
    type,
    quantity,
    previousStock,
    newStock,
    reference,
    notes,
    createdBy,
  }) {
    return insert(
      `INSERT INTO stock_history
        (product_id, type, quantity, previous_stock, new_stock, reference, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        type,
        quantity,
        previousStock,
        newStock,
        reference || "",
        notes || "",
        createdBy || "",
      ],
    );
  },

  findStockHistory(productId, limit = 50) {
    return query(
      `SELECT sh.*, p.name AS product_name
       FROM stock_history sh JOIN products p ON sh.product_id = p.id
       WHERE sh.product_id = ? ORDER BY sh.created_at DESC LIMIT ${safeInt(limit, 50)}`,
      [productId],
    );
  },

  // ─── Categories ─────────────────────────────────────────────────────────
  // product_count disertakan supaya UI kelola kategori bisa memberi tahu
  // pengguna berapa produk yang akan jadi "Tanpa Kategori" sebelum menghapus.
  findAllCategories() {
    return query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM products p
                WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
       FROM categories c ORDER BY c.name`,
    );
  },

  createCategory(name, description) {
    return insert("INSERT INTO categories (name, description) VALUES (?, ?)", [
      name,
      description || "",
    ]);
  },

  findCategoryById(id) {
    return queryOne("SELECT * FROM categories WHERE id = ?", [id]);
  },

  countProductsByCategory(id) {
    return queryOne(
      "SELECT COUNT(*) AS total FROM products WHERE category_id = ? AND is_active = 1",
      [id],
    );
  },

  deleteCategory(id) {
    return execute("DELETE FROM categories WHERE id = ?", [id]);
  },

  // ─── Reorder Point ──────────────────────────────────────────────────────
  // Hanya produk aktif dengan lead_time_value TERISI yang ikut dihitung —
  // NULL berarti admin belum mengatur lead time untuk produk ini, jadi ROP
  // tidak bermakna (lihat komentar kolom di database/reorder_point.sql).
  findAllWithLeadTime() {
    return query(
      `SELECT p.id, p.name, p.barcode, p.unit, p.stock, p.min_stock,
              p.lead_time_value, p.safety_stock_value, p.rop_time_unit,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = 1 AND p.lead_time_value IS NOT NULL
       ORDER BY p.name ASC`,
    );
  },

  // ─── Digunakan modul akuntansi: nilai persediaan berjalan ──────────────────
  sumInventoryValue() {
    return queryOne(
      `SELECT
         COALESCE(SUM(stock * cost_price), 0) AS inventory_value_at_cost,
         COALESCE(SUM(stock * price), 0)      AS inventory_value_at_retail,
         COALESCE(SUM(stock), 0)              AS total_units
       FROM products WHERE is_active = 1`,
    );
  },
};

module.exports = productModel;
