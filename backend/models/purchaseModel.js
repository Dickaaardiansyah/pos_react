// models/purchaseModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — akses data untuk pembelian stok (barang masuk) & supplier.
// ─────────────────────────────────────────────────────────────────────────────
const {
  query,
  queryOne,
  insert,
  execute,
  transaction,
  safeInt,
} = require("../config/database");
const journalService = require("../services/journalService");

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const purchaseModel = {
  // ─── Suppliers ──────────────────────────────────────────────────────────
  findAllSuppliers() {
    return query(
      "SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC",
    );
  },
  createSupplier({ name, phone, address, notes }) {
    return insert(
      "INSERT INTO suppliers (name, phone, address, notes) VALUES (?, ?, ?, ?)",
      [name, phone || "", address || "", notes || ""],
    );
  },
  findSupplierById(id) {
    return queryOne("SELECT * FROM suppliers WHERE id = ?", [id]);
  },
  updateSupplier(id, existing, patch) {
    return execute(
      "UPDATE suppliers SET name=?, phone=?, address=?, notes=?, is_active=? WHERE id=?",
      [
        patch.name ?? existing.name,
        patch.phone ?? existing.phone,
        patch.address ?? existing.address,
        patch.notes ?? existing.notes,
        patch.isActive !== undefined ? patch.isActive : existing.is_active,
        id,
      ],
    );
  },
  deactivateSupplier(id) {
    return execute("UPDATE suppliers SET is_active = 0 WHERE id = ?", [id]);
  },

  // ─── Purchases (header + item) ─────────────────────────────────────────
  async createPurchase({
    items,
    supplierId,
    supplierName,
    purchaseCode,
    purchaseDate,
    notes,
    recordedBy,
    occurredAt,
    notaUrl,
    notaOriginalName,
    paymentMethod, // 'tunai' | 'kredit'
    dueDate, // wajib diisi jika paymentMethod === 'kredit'
    payableInvoiceCode, // kode faktur hutang, dibuat di service jika kredit
    shiftId, // FIX (revisi dosen #17): sesi kas aktif kalau tunai & ada shift terbuka — lihat cashRegisterService.buildShiftSummary()
  }) {
    return transaction(async (conn) => {
      // 1) FOR UPDATE — kunci baris produk sebelum baca stock/cost_price.
      // Tanpa ini, dua pembelian untuk produk yang sama yang diproses
      // bersamaan bisa membaca stock/cost_price lama yang sama, lalu
      // saling menimpa hasil UPDATE (lost update): stok & HPP rata-rata
      // (weighted average cost) jadi salah. Satu SELECT ... FOR UPDATE per
      // produk sudah cukup — lock dipegang connection ini sampai commit,
      // jadi baris item lain yang product_id-nya sama (pakai productCache)
      // tidak perlu lock ulang.
      //
      // Sekaligus resolve & validasi satuan beli (product_units) kalau
      // item-nya pakai satuan selain satuan dasar (mis. beli per Karung
      // untuk produk yang stoknya dihitung per kg). conversion_qty diambil
      // dari DB di sini (BUKAN dipercaya mentah dari payload client) —
      // supaya HPP rata-rata & penambahan stok tidak bisa dimanipulasi
      // lewat request API langsung kalau ada yang mengirim conversion_qty
      // yang salah/dipalsukan.
      const productCache = {};
      const unitCache = {};
      for (const item of items) {
        if (!productCache[item.product_id]) {
          const [rows] = await conn.execute(
            "SELECT * FROM products WHERE id = ? AND is_active = 1 FOR UPDATE",
            [item.product_id],
          );
          const product = rows[0];
          if (!product)
            throw new Error(`Produk ID ${item.product_id} tidak ditemukan`);
          productCache[item.product_id] = product;
        }

        if (item.purchase_unit_id != null && item.purchase_unit_id !== "") {
          const cacheKey = `${item.product_id}:${item.purchase_unit_id}`;
          if (!unitCache[cacheKey]) {
            const [unitRows] = await conn.execute(
              `SELECT pu.conversion_qty, u.name AS unit_name
               FROM product_units pu JOIN units u ON pu.unit_id = u.id
               WHERE pu.id = ? AND pu.product_id = ?`,
              [item.purchase_unit_id, item.product_id],
            );
            const unitRow = unitRows[0];
            if (!unitRow)
              throw new Error(
                `Satuan beli tidak valid untuk produk "${productCache[item.product_id].name}"`,
              );
            unitCache[cacheKey] = unitRow;
          }
        }
      }

      // 2) Siapkan qty & harga per baris dalam SATUAN DASAR — konversi
      // dihitung di backend (bukan cuma di frontend seperti sebelumnya),
      // mirror dari qtyInBase di transactionModel.createSale(). `quantity`
      // pada payload berarti jumlah dalam satuan yang DIPILIH kasir/admin
      // (mis. 2 Karung), bukan lagi hasil konversi manual dari frontend.
      const prepared = items.map((item) => {
        const purchaseQty = Number(item.quantity);
        if (!Number.isFinite(purchaseQty) || purchaseQty <= 0)
          throw new Error(
            `Jumlah pembelian untuk produk ID ${item.product_id} tidak valid`,
          );

        const unitCostInput = Number(item.unit_cost);
        if (!Number.isFinite(unitCostInput) || unitCostInput < 0)
          throw new Error(
            `Harga beli untuk produk ID ${item.product_id} tidak valid`,
          );

        const hasUnit =
          item.purchase_unit_id != null && item.purchase_unit_id !== "";
        const unitRow = hasUnit
          ? unitCache[`${item.product_id}:${item.purchase_unit_id}`]
          : null;
        const factor = unitRow ? Number(unitRow.conversion_qty) || 1 : 1;
        if (factor <= 0) throw new Error("Faktor konversi satuan tidak valid");

        // qty & harga dikonversi ke satuan dasar produk — inilah yang
        // dipakai untuk update stok & hitung HPP rata-rata, persis seperti
        // semantik quantity/unit_cost sebelum migration ini.
        const qtyInBase = Math.round(purchaseQty * factor * 1000) / 1000;
        const costPerBase = unitRow
          ? Math.round((unitCostInput / factor) * 100) / 100
          : unitCostInput;

        return {
          item,
          purchaseQty, // jumlah asli dlm satuan beli, utk audit trail
          qtyInBase,
          costPerBase,
          purchaseUnitId: unitRow ? Number(item.purchase_unit_id) : null,
          unitLabel: unitRow ? unitRow.unit_name : null,
          conversionQty: factor,
        };
      });

      let totalQty = 0,
        totalCost = 0;
      for (const row of prepared) {
        totalQty += row.qtyInBase;
        totalCost += row.costPerBase * row.qtyInBase;
      }

      const isCredit = paymentMethod === "kredit";

      const [purchaseResult] = await conn.execute(
        `INSERT INTO purchases
           (purchase_code, supplier_id, supplier_name, purchase_date, payment_method, shift_id, due_date, total_items, total_qty, total_cost, notes, nota_url, nota_original_name, recorded_by, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
        [
          purchaseCode,
          supplierId || null,
          supplierName || "",
          purchaseDate,
          isCredit ? "kredit" : "tunai",
          isCredit ? null : shiftId || null,
          isCredit ? dueDate : null,
          items.length,
          totalQty,
          totalCost,
          notes || "",
          notaUrl || null,
          notaOriginalName || null,
          recordedBy || "Admin",
          occurredAt,
        ],
      );

      const purchaseId = purchaseResult.insertId;
      const insertedItems = [];

      for (const row of prepared) {
        const product = productCache[row.item.product_id];
        const subtotal = round2(row.costPerBase * row.qtyInBase);
        const previousStock = product.stock;
        const newStock = previousStock + row.qtyInBase;

        // ─── Metode HPP: Rata-rata Bergerak (Moving/Weighted Average) ───────
        // Setiap kali barang masuk, harga modal (cost_price) produk dihitung
        // ulang sebagai rata-rata tertimbang antara nilai stok lama & nilai
        // pembelian baru:
        //   HPP baru = (stok lama × HPP lama + qty beli × harga beli) / stok baru
        // Ini membuat harga modal produk selalu mencerminkan biaya rata-rata
        // seluruh stok yang ada — bukan harga beli terakhir (last cost) atau
        // FIFO — sesuai metode HPP yang dipakai toko ini (Average). Qty &
        // harga beli di sini SUDAH dalam satuan dasar (row.qtyInBase /
        // row.costPerBase), walau kasir aslinya input dalam satuan lain
        // (mis. Karung).
        // Kalau stok lama 0/negatif (produk baru atau sempat minus), HPP baru
        // = harga beli kali ini saja (tidak ada stok lama untuk dirata-rata).
        const previousCost = parseFloat(product.cost_price) || 0;
        const incomingCost = row.costPerBase;
        const newAvgCost =
          newStock > 0
            ? previousStock > 0
              ? round2(
                  (previousStock * previousCost +
                    row.qtyInBase * incomingCost) /
                    newStock,
                )
              : round2(incomingCost)
            : previousCost;

        await conn.execute(
          `INSERT INTO purchase_items
             (purchase_id, product_id, product_name, product_barcode, purchase_unit_id, unit_label, conversion_qty, purchase_qty, quantity, expiry_date, unit_cost, subtotal_cost, previous_stock, new_stock, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            purchaseId,
            product.id,
            product.name,
            product.barcode || "",
            row.purchaseUnitId,
            row.unitLabel,
            row.conversionQty,
            row.purchaseQty,
            row.qtyInBase,
            row.item.expiry_date || null,
            row.costPerBase,
            subtotal,
            previousStock,
            newStock,
            occurredAt,
          ],
        );

        await conn.execute(
          "UPDATE products SET stock = ?, cost_price = ? WHERE id = ?",
          [newStock, newAvgCost, product.id],
        );
        // Ikut perbarui cache lokal supaya kalau produk yang sama muncul lagi
        // di baris item pembelian lain (purchase_id sama), perhitungan rata-
        // rata berikutnya memakai HPP & stok yang sudah ter-update.
        product.stock = newStock;
        product.cost_price = newAvgCost;

        await conn.execute(
          `INSERT INTO stock_history (product_id, type, quantity, previous_stock, new_stock, reference, notes, created_by)
           VALUES (?, 'in', ?, ?, ?, ?, 'Pembelian stok', ?)`,
          [
            product.id,
            row.qtyInBase,
            previousStock,
            newStock,
            purchaseCode,
            recordedBy || "Admin",
          ],
        );

        insertedItems.push({
          product_id: product.id,
          product_name: product.name,
          product_barcode: product.barcode || "",
          purchase_unit_id: row.purchaseUnitId,
          unit_label: row.unitLabel,
          conversion_qty: row.conversionQty,
          purchase_qty: row.purchaseQty,
          quantity: row.qtyInBase,
          expiry_date: row.item.expiry_date || null,
          unit_cost: row.costPerBase,
          subtotal_cost: subtotal,
          previous_stock: previousStock,
          new_stock: newStock,
          previous_avg_cost: previousCost,
          new_avg_cost: newAvgCost,
          unit: product.unit || "pcs",
        });
      }

      // Kredit → langsung buat faktur Hutang (payables) berstatus
      // 'belum_lunas', ditautkan ke purchase_id, dalam transaksi DB yang
      // sama dengan pembelian & penambahan stok — supaya tidak ada faktur
      // hutang yang "hilang" kalau salah satu langkah gagal. Mirror dari
      // pola Open Bill di transactionModel.createSale().
      let payable = null;
      if (isCredit) {
        const [payResult] = await conn.execute(
          `INSERT INTO payables
             (invoice_code, supplier_id, supplier_name, purchase_id, amount, paid_amount,
              invoice_date, due_date, status, notes, recorded_by)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'belum_lunas', ?, ?)`,
          [
            payableInvoiceCode,
            supplierId || null,
            supplierName || "",
            purchaseId,
            totalCost,
            purchaseDate,
            dueDate,
            `Hutang dari pembelian ${purchaseCode}`,
            recordedBy || "Admin",
          ],
        );
        payable = {
          id: payResult.insertId,
          invoice_code: payableInvoiceCode,
          supplier_id: supplierId || null,
          supplier_name: supplierName || "",
          purchase_id: purchaseId,
          amount: totalCost,
          paid_amount: 0,
          invoice_date: purchaseDate,
          due_date: dueDate,
          status: "belum_lunas",
        };
      }

      const purchase = {
        id: purchaseId,
        purchase_code: purchaseCode,
        supplier_id: supplierId || null,
        supplier_name: supplierName || "",
        purchase_date: purchaseDate,
        payment_method: isCredit ? "kredit" : "tunai",
        due_date: isCredit ? dueDate : null,
        total_items: items.length,
        total_qty: totalQty,
        total_cost: totalCost,
        notes: notes || "",
        nota_url: notaUrl || null,
        nota_original_name: notaOriginalName || null,
        recorded_by: recordedBy || "Admin",
        status: "confirmed",
        created_at: occurredAt,
        items: insertedItems,
        payable,
      };

      // Posting jurnal (Dr Persediaan, Cr Kas/Utang Usaha) di dalam transaksi
      // DB yang sama — kalau gagal, pembelian & perubahan stok/HPP rata-rata
      // di atas ikut rollback (lihat catatan desain di journalService.js).
      await journalService.postPurchaseJournal(purchase, conn);

      return purchase;
    });
  },

  findAll({ startDate, endDate, supplierId, search, limit, offset }) {
    let where = "WHERE 1=1";
    const params = [];
    if (startDate) {
      where += " AND p.purchase_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND p.purchase_date <= ?";
      params.push(endDate);
    }
    if (supplierId) {
      where += " AND p.supplier_id = ?";
      params.push(supplierId);
    }
    if (search) {
      where +=
        " AND (p.purchase_code LIKE ? OR p.supplier_name LIKE ? OR s.name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    return Promise.all([
      query(
        `SELECT COUNT(*) AS total FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id ${where}`,
        params,
      ).then((r) => r[0]?.total || 0),
      query(
        `SELECT p.*, s.name AS supplier_name_ref,
                pay.id AS payable_id, pay.status AS payable_status,
                pay.amount AS payable_amount, pay.paid_amount AS payable_paid_amount
         FROM purchases p
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         LEFT JOIN payables pay ON pay.purchase_id = p.id
         ${where} ORDER BY p.purchase_date DESC, p.created_at DESC LIMIT ${safeInt(limit, 20)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([total, rows]) => ({ total, rows }));
  },

  findById(id) {
    return queryOne(
      `SELECT p.*, s.name AS supplier_name_ref, s.phone AS supplier_phone,
              pay.id AS payable_id, pay.invoice_code AS payable_invoice_code,
              pay.status AS payable_status, pay.amount AS payable_amount,
              pay.paid_amount AS payable_paid_amount, pay.due_date AS payable_due_date
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN payables pay ON pay.purchase_id = p.id
       WHERE p.id = ?`,
      [id],
    );
  },

  findItemsByPurchaseId(id) {
    return query(
      `SELECT pi.*, pr.unit FROM purchase_items pi LEFT JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = ? ORDER BY pi.id ASC`,
      [id],
    );
  },

  reportByPeriod(period, startDate, endDate) {
    const groupExpr =
      period === "weekly"
        ? "DATE_FORMAT(p.purchase_date, '%Y-W%u')"
        : period === "monthly"
          ? "DATE_FORMAT(p.purchase_date, '%Y-%m')"
          : "p.purchase_date";
    return query(
      `SELECT ${groupExpr} AS period, COUNT(DISTINCT p.id) AS purchase_count,
              SUM(p.total_qty) AS total_qty, SUM(p.total_cost) AS total_cost
       FROM purchases p WHERE p.purchase_date BETWEEN ? AND ? AND p.status = 'confirmed'
       GROUP BY ${groupExpr} ORDER BY period ASC`,
      [startDate, endDate],
    );
  },

  reportSummary(startDate, endDate) {
    return queryOne(
      `SELECT COUNT(DISTINCT p.id) AS total_purchases, COALESCE(SUM(p.total_qty),0) AS total_qty,
              COALESCE(SUM(p.total_cost),0) AS total_cost, COUNT(DISTINCT p.supplier_id) AS total_suppliers
       FROM purchases p WHERE p.purchase_date BETWEEN ? AND ? AND p.status = 'confirmed'`,
      [startDate, endDate],
    );
  },

  reportTopProducts(startDate, endDate, limit = 20) {
    return query(
      `SELECT pi.product_name, SUM(pi.quantity) AS total_qty, SUM(pi.subtotal_cost) AS total_cost,
              COUNT(DISTINCT pi.purchase_id) AS purchase_count
       FROM purchase_items pi JOIN purchases p ON pi.purchase_id = p.id
       WHERE p.purchase_date BETWEEN ? AND ? AND p.status = 'confirmed'
       GROUP BY pi.product_id ORDER BY total_qty DESC LIMIT ${safeInt(limit, 20)}`,
      [startDate, endDate],
    );
  },

  reportPerSupplier(startDate, endDate) {
    return query(
      `SELECT COALESCE(p.supplier_name, 'Tanpa Supplier') AS supplier, COUNT(DISTINCT p.id) AS purchase_count,
              COALESCE(SUM(p.total_cost),0) AS total_cost, COALESCE(SUM(p.total_qty),0) AS total_qty
       FROM purchases p WHERE p.purchase_date BETWEEN ? AND ? AND p.status = 'confirmed'
       GROUP BY p.supplier_id, p.supplier_name ORDER BY total_cost DESC`,
      [startDate, endDate],
    );
  },

  // ─── Laporan Barang Expired (per batch barang masuk) ───────────────────
  // Status batch dihitung dari selisih hari antara expiry_date & hari ini:
  //   expired  → sudah lewat tanggal kadaluarsa
  //   soon     → akan kadaluarsa dalam `thresholdDays` hari ke depan
  //   safe     → masih aman
  reportExpiredItems({ startDate, endDate, status, thresholdDays = 30 }) {
    const days = Number(thresholdDays) || 30;
    let where = "WHERE pi.expiry_date IS NOT NULL";
    const params = [];
    if (startDate) {
      where += " AND pi.expiry_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND pi.expiry_date <= ?";
      params.push(endDate);
    }
    const statusExpr = `CASE
      WHEN DATEDIFF(pi.expiry_date, CURDATE()) < 0 THEN 'expired'
      WHEN DATEDIFF(pi.expiry_date, CURDATE()) <= ${days} THEN 'soon'
      ELSE 'safe' END`;
    if (status) {
      where += ` AND ${statusExpr} = ?`;
      params.push(status);
    }
    return query(
      `SELECT pi.id, pi.purchase_id, p.purchase_code, p.purchase_date, p.supplier_name,
              pi.product_id, pi.product_name, pi.product_barcode, pi.quantity, pi.unit_cost,
              pi.subtotal_cost, pi.expiry_date, DATEDIFF(pi.expiry_date, CURDATE()) AS days_left,
              ${statusExpr} AS status, pr.stock AS current_stock, pr.unit
       FROM purchase_items pi
       JOIN purchases p ON pi.purchase_id = p.id
       LEFT JOIN products pr ON pi.product_id = pr.id
       ${where} AND p.status = 'confirmed'
       ORDER BY pi.expiry_date ASC`,
      params,
    );
  },

  reportExpiredSummary({ startDate, endDate, thresholdDays = 30 }) {
    const days = Number(thresholdDays) || 30;
    let where = "WHERE pi.expiry_date IS NOT NULL";
    const params = [];
    if (startDate) {
      where += " AND pi.expiry_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND pi.expiry_date <= ?";
      params.push(endDate);
    }
    return queryOne(
      `SELECT
         COUNT(*) AS total_batches,
         COALESCE(SUM(CASE WHEN DATEDIFF(pi.expiry_date, CURDATE()) < 0 THEN 1 ELSE 0 END),0) AS total_expired,
         COALESCE(SUM(CASE WHEN DATEDIFF(pi.expiry_date, CURDATE()) BETWEEN 0 AND ${days} THEN 1 ELSE 0 END),0) AS total_soon,
         COALESCE(SUM(CASE WHEN DATEDIFF(pi.expiry_date, CURDATE()) < 0 THEN pi.quantity ELSE 0 END),0) AS total_qty_expired,
         COALESCE(SUM(CASE WHEN DATEDIFF(pi.expiry_date, CURDATE()) < 0 THEN pi.subtotal_cost ELSE 0 END),0) AS total_value_expired
       FROM purchase_items pi
       JOIN purchases p ON pi.purchase_id = p.id
       ${where} AND p.status = 'confirmed'`,
      params,
    );
  },

  dashboardThisMonth() {
    return queryOne(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total_cost),0) AS total_cost, COALESCE(SUM(total_qty),0) AS total_qty
       FROM purchases WHERE YEAR(purchase_date)=YEAR(CURDATE()) AND MONTH(purchase_date)=MONTH(CURDATE()) AND status='confirmed'`,
    );
  },
  dashboardLastMonth() {
    return queryOne(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total_cost),0) AS total_cost
       FROM purchases WHERE YEAR(purchase_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH))
         AND MONTH(purchase_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND status='confirmed'`,
    );
  },
  dashboardRecent(limit = 5) {
    return query(
      `SELECT p.*, s.name AS supplier_ref FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id
       WHERE p.status='confirmed' ORDER BY p.purchase_date DESC, p.created_at DESC LIMIT ${safeInt(limit, 5)}`,
    );
  },
  dashboardTopProductsThisMonth(limit = 5) {
    return query(
      `SELECT pi.product_name, SUM(pi.quantity) AS qty
       FROM purchase_items pi JOIN purchases p ON pi.purchase_id=p.id
       WHERE YEAR(p.purchase_date)=YEAR(CURDATE()) AND MONTH(p.purchase_date)=MONTH(CURDATE()) AND p.status='confirmed'
       GROUP BY pi.product_id ORDER BY qty DESC LIMIT ${safeInt(limit, 5)}`,
    );
  },

  deletePurchase(id) {
    return execute("DELETE FROM purchases WHERE id = ?", [id]);
  },
};

module.exports = purchaseModel;
