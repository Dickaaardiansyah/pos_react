// models/stockOpnameModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — satu-satunya lapisan yang boleh menyentuh SQL untuk domain
// "stock opname". Menyimpan sesi opname beserta detail per produk, lalu
// menerapkan penyesuaian stok (adjustment) & mencatatnya ke stock_history
// dalam satu transaksi database.
// ─────────────────────────────────────────────────────────────────────────────
const { query, queryOne, transaction, safeInt } = require("../config/database");
const journalService = require("../services/journalService");

const stockOpnameModel = {
  /**
   * Membuat satu sesi stock opname secara utuh:
   *  1. Ambil stok sistem terkini (FOR UPDATE) untuk tiap produk yang diperiksa.
   *  2. Simpan header sesi + detail per item (stok sistem, stok fisik, selisih).
   *  3. Untuk item yang selisih != 0, sesuaikan stok produk & catat stock_history
   *     dengan type='adjustment' agar tercermin di Mutasi Stok.
   *
   * items: [{ product_id, physical_stock, notes }]
   */
  async createSession({
    opnameCode,
    opnameDate,
    notes,
    recordedBy,
    items,
    occurredAt,
  }) {
    return transaction(async (conn) => {
      const productCache = {};
      for (const item of items) {
        const [rows] = await conn.execute(
          "SELECT * FROM products WHERE id = ? FOR UPDATE",
          [item.product_id],
        );
        const product = rows[0];
        if (!product)
          throw new Error(`Produk ID ${item.product_id} tidak ditemukan`);
        productCache[item.product_id] = product;
      }

      let totalDiffQty = 0;
      let totalDiffValue = 0;
      let totalItemsSelisih = 0;
      const detailRows = [];

      for (const item of items) {
        const product = productCache[item.product_id];
        const systemStock = product.stock;
        const physicalStock = parseFloat(item.physical_stock);
        if (isNaN(physicalStock) || physicalStock < 0) {
          throw new Error(
            `Stok fisik untuk produk "${product.name}" tidak valid: "${item.physical_stock}"`,
          );
        }
        const difference = Number((physicalStock - systemStock).toFixed(3));
        const differenceValue = Number(
          (difference * parseFloat(product.cost_price || 0)).toFixed(2),
        );

        if (difference !== 0) {
          totalItemsSelisih += 1;
          totalDiffQty += difference;
          totalDiffValue += differenceValue;
        }

        detailRows.push({
          product,
          systemStock,
          physicalStock,
          difference,
          differenceValue,
          notes: item.notes || "",
        });
      }

      const [sessionResult] = await conn.execute(
        `INSERT INTO stock_opname_sessions
           (opname_code, opname_date, total_items, total_items_selisih, total_difference_qty, total_difference_value, notes, recorded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          opnameCode,
          opnameDate,
          items.length,
          totalItemsSelisih,
          totalDiffQty,
          totalDiffValue,
          notes || "",
          recordedBy || "Admin",
          occurredAt,
        ],
      );
      const sessionId = sessionResult.insertId;
      const insertedItems = [];

      for (const row of detailRows) {
        const {
          product,
          systemStock,
          physicalStock,
          difference,
          differenceValue,
          notes: itemNotes,
        } = row;

        const [itemResult] = await conn.execute(
          `INSERT INTO stock_opname_items
             (session_id, product_id, product_name, product_barcode, unit, system_stock, physical_stock, difference, difference_value, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionId,
            product.id,
            product.name,
            product.barcode || "",
            product.unit || "pcs",
            systemStock,
            physicalStock,
            difference,
            differenceValue,
            itemNotes,
            occurredAt,
          ],
        );

        if (difference !== 0) {
          await conn.execute("UPDATE products SET stock = ? WHERE id = ?", [
            physicalStock,
            product.id,
          ]);
          await conn.execute(
            `INSERT INTO stock_history (product_id, type, quantity, previous_stock, new_stock, reference, notes, created_by, created_at)
             VALUES (?, 'adjustment', ?, ?, ?, ?, ?, ?, ?)`,
            [
              product.id,
              Math.abs(difference),
              systemStock,
              physicalStock,
              opnameCode,
              `Stock Opname — ${difference > 0 ? "kelebihan" : "kekurangan"} stok fisik`,
              recordedBy || "Admin",
              occurredAt,
            ],
          );
        }

        insertedItems.push({
          id: itemResult.insertId,
          product_id: product.id,
          product_name: product.name,
          product_barcode: product.barcode || "",
          unit: product.unit || "pcs",
          system_stock: systemStock,
          physical_stock: physicalStock,
          difference,
          difference_value: differenceValue,
          notes: itemNotes,
        });
      }

      const session = {
        id: sessionId,
        opname_code: opnameCode,
        opname_date: opnameDate,
        total_items: items.length,
        total_items_selisih: totalItemsSelisih,
        total_difference_qty: totalDiffQty,
        total_difference_value: totalDiffValue,
        notes: notes || "",
        recorded_by: recordedBy || "Admin",
        created_at: occurredAt,
        items: insertedItems,
      };

      // Posting jurnal penyesuaian selisih stok (kalau ada) di dalam
      // transaksi DB yang sama — kalau gagal, penyesuaian stok/stock_history
      // di atas ikut rollback.
      await journalService.postStockOpnameJournal(session, conn);

      return session;
    });
  },

  findAll({ startDate, endDate, limit = 50, offset = 0 } = {}) {
    const params = [];
    let where = "WHERE 1=1";
    if (startDate) {
      where += " AND opname_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND opname_date <= ?";
      params.push(endDate);
    }

    return Promise.all([
      queryOne(
        `SELECT COUNT(*) AS total FROM stock_opname_sessions ${where}`,
        params,
      ),
      query(
        `SELECT * FROM stock_opname_sessions ${where} ORDER BY opname_date DESC, created_at DESC LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([totalRow, rows]) => ({
      total: Number(totalRow?.total || 0),
      rows,
    }));
  },

  findById(id) {
    return queryOne("SELECT * FROM stock_opname_sessions WHERE id = ?", [id]);
  },

  findItemsBySessionId(sessionId) {
    return query(
      "SELECT * FROM stock_opname_items WHERE session_id = ? ORDER BY product_name",
      [sessionId],
    );
  },

  // Daftar produk aktif untuk dipilih ke dalam sesi opname baru.
  findProductsForOpname({ search, category } = {}) {
    let sql = `
      SELECT p.id, p.name, p.barcode, p.stock, p.unit, p.cost_price, c.name AS category_name
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    const params = [];
    if (category) {
      sql += " AND p.category_id = ?";
      params.push(category);
    }
    if (search) {
      sql += " AND (p.name LIKE ? OR p.barcode LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += " ORDER BY p.name ASC";
    return query(sql, params);
  },
};

module.exports = stockOpnameModel;
